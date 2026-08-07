import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { UserEntity } from '../iam/entities/user.entity';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import {
  AdjustAttendanceDto,
  AttendanceQueryDto,
  AttendanceReportQueryDto,
  CheckInDto,
  CheckOutDto,
  ManualAttendanceDto,
} from './dto/attendance.dto';
import { AttendanceEntity } from './entities/attendance.entity';
import { toBsKey, type AttendanceStatus } from './hr.constants';
import {
  AttendanceInvalidCheckoutException,
  AttendanceInvalidLocationException,
  AttendanceNotFoundException,
  AttendanceNoOpenRecordException,
  AttendanceNotReporteeException,
  AttendanceOpenRecordConflictException,
} from './hr.errors';

const MAX_LATITUDE = 90;
const MIN_LATITUDE = -90;
const MAX_LONGITUDE = 180;
const MIN_LONGITUDE = -180;

function toFixedCoord(value: number | undefined): string | null {
  if (value === undefined || value === null) return null;
  return value.toFixed(7);
}

function validateCoord(lat: number | undefined, lng: number | undefined): void {
  if (lat !== undefined && (lat < MIN_LATITUDE || lat > MAX_LATITUDE)) {
    throw new AttendanceInvalidLocationException(
      'Latitude must be between -90 and 90',
    );
  }
  if (lng !== undefined && (lng < MIN_LONGITUDE || lng > MAX_LONGITUDE)) {
    throw new AttendanceInvalidLocationException(
      'Longitude must be between -180 and 180',
    );
  }
}

function toBsKeyOf(d: Date, converter: NepaliDateConverter): string {
  const bs = converter.adToBs(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return toBsKey(bs.bsYear, bs.bsMonth, bs.bsDay);
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceEntity)
    private readonly attendanceRepo: Repository<AttendanceEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly audit: AuditService,
    private readonly nepaliDate: NepaliDateConverter,
  ) {}

  // ---- Device check-in / check-out ---------------------------------------

  async checkIn(
    organizationId: string,
    actorId: string,
    dto: CheckInDto,
  ): Promise<AttendanceEntity> {
    validateCoord(dto.latitude, dto.longitude);

    const open = await this.attendanceRepo.findOne({
      where: { organizationId, userId: actorId, status: 'OPEN' },
    });
    if (open) throw new AttendanceOpenRecordConflictException();

    const checkinAt = new Date();
    const record = await this.attendanceRepo.save(
      this.attendanceRepo.create({
        organizationId,
        userId: actorId,
        bsDate: toBsKeyOf(checkinAt, this.nepaliDate),
        status: 'OPEN',
        source: 'DEVICE',
        checkinAt,
        checkinRemarks: dto.remarks ?? null,
        checkinLatitude: toFixedCoord(dto.latitude),
        checkinLongitude: toFixedCoord(dto.longitude),
      }),
    );

    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'hr.attendance.checkin',
      entityType: 'attendance',
      entityId: record.id,
      newData: { checkinAt: checkinAt.toISOString() },
    });
    return record;
  }

  async checkOut(
    organizationId: string,
    actorId: string,
    dto: CheckOutDto,
  ): Promise<AttendanceEntity> {
    validateCoord(dto.latitude, dto.longitude);

    const record = await this.attendanceRepo.findOne({
      where: { organizationId, userId: actorId, status: 'OPEN' },
    });
    if (!record) throw new AttendanceNoOpenRecordException();

    const checkoutAt = new Date();
    if (checkoutAt <= record.checkinAt) {
      throw new AttendanceInvalidCheckoutException(
        'Check-out must be after check-in',
      );
    }

    record.checkoutAt = checkoutAt;
    record.checkoutRemarks = dto.remarks ?? null;
    record.checkoutLatitude = toFixedCoord(dto.latitude);
    record.checkoutLongitude = toFixedCoord(dto.longitude);
    record.durationMinutes = Math.max(
      0,
      Math.floor((checkoutAt.getTime() - record.checkinAt.getTime()) / 60000),
    );
    record.status = 'CLOSED';

    const saved = await this.attendanceRepo.save(record);
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'hr.attendance.checkout',
      entityType: 'attendance',
      entityId: saved.id,
      newData: {
        checkoutAt: checkoutAt.toISOString(),
        durationMinutes: saved.durationMinutes,
      },
    });
    return saved;
  }

  // ---- Listing (scoped like leave/travel) --------------------------------

  async list(
    organizationId: string,
    actorId: string,
    query: AttendanceQueryDto,
    scope: 'mine' | 'team' | 'all',
  ): Promise<AttendanceEntity[]> {
    const qb = this.attendanceRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.user', 'user')
      .where('a.organization_id = :organizationId', { organizationId });

    if (scope === 'mine') {
      qb.andWhere('a.user_id = :actorId', { actorId });
    } else if (scope === 'team') {
      const teamIds = await this.userRepo
        .find({ where: { organizationId, managerId: actorId } })
        .then((rows) => rows.map((r) => r.id));
      if (teamIds.length === 0) return [];
      qb.andWhere('a.user_id IN (:...teamIds)', { teamIds });
    }
    if (query.status) {
      qb.andWhere('a.status = :status', { status: query.status });
    }
    if (query.source) {
      qb.andWhere('a.source = :source', { source: query.source });
    }
    if (query.userId) {
      qb.andWhere('a.user_id = :userId', { userId: query.userId });
    }
    if (query.fromBs) {
      qb.andWhere('a.bs_date >= :fromBs', { fromBs: query.fromBs });
    }
    if (query.toBs) {
      qb.andWhere('a.bs_date <= :toBs', { toBs: query.toBs });
    }
    return qb
      .orderBy('a.checkin_at', 'DESC')
      .addOrderBy('a.createdAt', 'DESC')
      .getMany();
  }

  // ---- Manager manual entry & adjustments --------------------------------

  async manualEntry(
    organizationId: string,
    actorId: string,
    dto: ManualAttendanceDto,
  ): Promise<AttendanceEntity> {
    validateCoord(dto.latitude, dto.longitude);
    validateCoord(dto.checkoutLatitude, dto.checkoutLongitude);

    const target = await this.userRepo.findOne({
      where: { id: dto.userId, organizationId },
    });
    if (!target || target.managerId !== actorId) {
      throw new AttendanceNotReporteeException();
    }

    const checkinAt = new Date(dto.checkinAt);
    if (Number.isNaN(checkinAt.getTime())) {
      throw new AttendanceInvalidCheckoutException('Invalid check-in time');
    }
    let checkoutAt: Date | null = null;
    let status: AttendanceStatus = 'OPEN';
    if (dto.checkoutAt) {
      checkoutAt = new Date(dto.checkoutAt);
      if (Number.isNaN(checkoutAt.getTime()) || checkoutAt <= checkinAt) {
        throw new AttendanceInvalidCheckoutException(
          'Check-out must be after check-in',
        );
      }
      status = 'CLOSED';
    }

    const open = await this.attendanceRepo.findOne({
      where: { organizationId, userId: target.id, status: 'OPEN' },
    });
    if (open) throw new AttendanceOpenRecordConflictException();

    const record = await this.attendanceRepo.save(
      this.attendanceRepo.create({
        organizationId,
        userId: target.id,
        bsDate: toBsKeyOf(checkinAt, this.nepaliDate),
        status,
        source: 'MANUAL',
        checkinAt,
        checkinRemarks: dto.remarks ?? null,
        checkinLatitude: toFixedCoord(dto.latitude),
        checkinLongitude: toFixedCoord(dto.longitude),
        checkoutAt,
        checkoutRemarks: dto.checkoutRemarks ?? null,
        checkoutLatitude: toFixedCoord(dto.checkoutLatitude),
        checkoutLongitude: toFixedCoord(dto.checkoutLongitude),
        durationMinutes:
          checkoutAt === null
            ? null
            : Math.max(
                0,
                Math.floor(
                  (checkoutAt.getTime() - checkinAt.getTime()) / 60000,
                ),
              ),
      }),
    );

    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'hr.attendance.manual',
      entityType: 'attendance',
      entityId: record.id,
      newData: { userId: target.id, source: 'MANUAL' },
    });
    return record;
  }

  async adjust(
    organizationId: string,
    actorId: string,
    id: string,
    dto: AdjustAttendanceDto,
  ): Promise<AttendanceEntity> {
    validateCoord(dto.latitude, dto.longitude);
    validateCoord(dto.checkoutLatitude, dto.checkoutLongitude);

    const record = await this.attendanceRepo.findOne({
      where: { id, organizationId },
    });
    if (!record) throw new AttendanceNotFoundException();

    if (record.userId !== actorId) {
      const owner = await this.userRepo.findOne({
        where: { id: record.userId, organizationId },
      });
      if (!owner || owner.managerId !== actorId) {
        throw new AttendanceNotReporteeException();
      }
    }

    let checkinAt = record.checkinAt;
    if (dto.checkinAt) {
      const parsed = new Date(dto.checkinAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new AttendanceInvalidCheckoutException('Invalid check-in time');
      }
      checkinAt = parsed;
      record.checkinAt = checkinAt;
      record.bsDate = toBsKeyOf(checkinAt, this.nepaliDate);
    }

    let checkoutAt = record.checkoutAt;
    if (dto.checkoutAt) {
      const parsed = new Date(dto.checkoutAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new AttendanceInvalidCheckoutException('Invalid check-out time');
      }
      if (parsed <= checkinAt) {
        throw new AttendanceInvalidCheckoutException(
          'Check-out must be after check-in',
        );
      }
      checkoutAt = parsed;
      record.checkoutAt = checkoutAt;
    }

    if (checkoutAt) {
      record.durationMinutes = Math.max(
        0,
        Math.floor((checkoutAt.getTime() - checkinAt.getTime()) / 60000),
      );
      record.status = 'CLOSED';
    }

    if (dto.remarks !== undefined) record.checkinRemarks = dto.remarks;
    if (dto.checkoutRemarks !== undefined) {
      record.checkoutRemarks = dto.checkoutRemarks;
    }
    if (dto.latitude !== undefined) {
      record.checkinLatitude = toFixedCoord(dto.latitude);
    }
    if (dto.longitude !== undefined) {
      record.checkinLongitude = toFixedCoord(dto.longitude);
    }
    if (dto.checkoutLatitude !== undefined) {
      record.checkoutLatitude = toFixedCoord(dto.checkoutLatitude);
    }
    if (dto.checkoutLongitude !== undefined) {
      record.checkoutLongitude = toFixedCoord(dto.checkoutLongitude);
    }

    const saved = await this.attendanceRepo.save(record);
    await this.audit.record({
      organizationId,
      userId: actorId,
      action: 'hr.attendance.adjust',
      entityType: 'attendance',
      entityId: saved.id,
      newData: {
        checkinAt: saved.checkinAt.toISOString(),
        checkoutAt: saved.checkoutAt?.toISOString() ?? null,
        status: saved.status,
      },
    });
    return saved;
  }

  // ---- Reports -----------------------------------------------------------

  async dailyReport(
    organizationId: string,
    actorId: string,
    query: AttendanceReportQueryDto,
  ): Promise<{ bsDate: string; records: AttendanceEntity[] }> {
    const bsDate = query.bsDate ?? toBsKeyOf(new Date(), this.nepaliDate);
    const records = await this.list(
      organizationId,
      actorId,
      {
        fromBs: bsDate,
        toBs: bsDate,
        page: query.page,
        limit: query.limit,
      },
      query.scope ?? 'mine',
    );
    return { bsDate, records };
  }

  async monthlyReport(
    organizationId: string,
    actorId: string,
    query: AttendanceReportQueryDto,
  ): Promise<{
    bsYear: number;
    bsMonth: number;
    monthDays: number;
    rows: Array<{
      userId: string;
      fullName: string;
      email: string;
      presentDays: number;
      totalMinutes: number | null;
      avgMinutes: number | null;
      absences: number;
    }>;
  }> {
    const today = this.nepaliDate.getTodayBsDate();
    const bsYear = query.bsYear ?? today.bsYear;
    const bsMonth = query.bsMonth ?? today.bsMonth;
    const monthDays = this.nepaliDate.getDaysInBsMonth(bsYear, bsMonth);
    const fromBs = toBsKey(bsYear, bsMonth, 1);
    const toBs = toBsKey(bsYear, bsMonth, monthDays);

    const records = await this.list(
      organizationId,
      actorId,
      { fromBs, toBs, page: 1, limit: 10000 },
      query.scope ?? 'mine',
    );

    const byUser = new Map<
      string,
      {
        fullName: string;
        email: string;
        presentDates: Set<string>;
        totalMinutes: number;
      }
    >();
    for (const record of records) {
      const key = record.userId;
      let row = byUser.get(key);
      if (!row) {
        row = {
          fullName: record.user?.fullName ?? 'Unknown',
          email: record.user?.email ?? '',
          presentDates: new Set(),
          totalMinutes: 0,
        };
        byUser.set(key, row);
      }
      row.presentDates.add(record.bsDate);
      if (record.durationMinutes !== null) {
        row.totalMinutes += record.durationMinutes;
      }
    }

    const rows = [...byUser.entries()].map(([userId, row]) => {
      const presentDays = row.presentDates.size;
      const totalMinutes = row.totalMinutes;
      return {
        userId,
        fullName: row.fullName,
        email: row.email,
        presentDays,
        totalMinutes,
        avgMinutes:
          presentDays > 0 ? Math.round(totalMinutes / presentDays) : null,
        absences: monthDays - presentDays,
      };
    });

    return { bsYear, bsMonth, monthDays, rows };
  }
}
