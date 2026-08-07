import { DataSource } from 'typeorm';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import { AttendanceService } from './attendance.service';
import { toBsKey } from './hr.constants';
import {
  AttendanceInvalidCheckoutException,
  AttendanceNotFoundException,
  AttendanceNoOpenRecordException,
  AttendanceNotReporteeException,
  AttendanceOpenRecordConflictException,
} from './hr.errors';
import {
  ACCOUNTANT_USER_ID,
  beginTestTransaction,
  createHrTestingModule,
  endTestTransaction,
  MANAGER_USER_ID,
  SALESMAN_USER_ID,
  seedHrBaseline,
  TEAMMATE_USER_ID,
  TEST_ORG_ID,
  type TestTransaction,
} from '../testing/hr-test.harness';
import { createTestDataSource } from '../testing/test-db';

describe('AttendanceService', () => {
  const actorId = SALESMAN_USER_ID;
  const managerId = MANAGER_USER_ID;

  let dataSource: DataSource;
  let service: AttendanceService;
  let converter: NepaliDateConverter;
  let tx: TestTransaction;

  /** Local-time ISO-ish construct so BS derivation is tz-independent. */
  const at = (y: number, m: number, d: number, h: number) =>
    new Date(y, m - 1, d, h, 0, 0, 0);
  const bsKeyOf = (d: Date) => {
    const bs = converter.adToBs(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return toBsKey(bs.bsYear, bs.bsMonth, bs.bsDay);
  };

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await seedHrBaseline(dataSource);
    const module = await createHrTestingModule(dataSource);
    service = module.get(AttendanceService);
    converter = module.get(NepaliDateConverter);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    tx = await beginTestTransaction(dataSource);
  });

  afterEach(async () => {
    await endTestTransaction(dataSource, tx);
  });

  describe('check-in', () => {
    it('creates an OPEN DEVICE record with derived BS date and GPS', async () => {
      const record = await service.checkIn(TEST_ORG_ID, actorId, {
        remarks: 'at office',
        latitude: 27.7172,
        longitude: 85.324,
      });
      expect(record.status).toBe('OPEN');
      expect(record.source).toBe('DEVICE');
      expect(record.checkinAt).toBeInstanceOf(Date);
      expect(record.checkoutAt).toBeNull();
      expect(record.durationMinutes).toBeNull();
      expect(record.bsDate).toBe(bsKeyOf(record.checkinAt));
      expect(record.checkinLatitude).toBe('27.7172000');
      expect(record.checkinRemarks).toBe('at office');
    });

    it('rejects a second check-in while an OPEN record exists', async () => {
      await service.checkIn(TEST_ORG_ID, actorId, {});
      await expect(service.checkIn(TEST_ORG_ID, actorId, {})).rejects.toThrow(
        AttendanceOpenRecordConflictException,
      );
    });
  });

  describe('check-out', () => {
    it('closes the record and derives duration', async () => {
      await service.checkIn(TEST_ORG_ID, actorId, {});
      const closed = await service.checkOut(TEST_ORG_ID, actorId, {
        remarks: 'leaving',
        latitude: 27.716,
        longitude: 85.33,
      });
      expect(closed.status).toBe('CLOSED');
      expect(closed.checkoutAt).toBeInstanceOf(Date);
      expect(closed.checkoutLatitude).toBe('27.7160000');
      expect(closed.checkoutRemarks).toBe('leaving');
      expect(closed.durationMinutes).toBeGreaterThanOrEqual(0);
      const expected = Math.floor(
        (closed.checkoutAt!.getTime() - closed.checkinAt.getTime()) / 60000,
      );
      expect(closed.durationMinutes).toBe(expected);
    });

    it('throws when there is no open record', async () => {
      await expect(service.checkOut(TEST_ORG_ID, actorId, {})).rejects.toThrow(
        AttendanceNoOpenRecordException,
      );
    });
  });

  describe('scoped listing', () => {
    it('mine shows only own records', async () => {
      await service.checkIn(TEST_ORG_ID, actorId, {});
      await service.checkIn(TEST_ORG_ID, TEAMMATE_USER_ID, {});
      const mine = await service.list(TEST_ORG_ID, actorId, {}, 'mine');
      expect(mine.map((r) => r.userId)).toEqual([actorId]);
    });

    it('team shows reportees only', async () => {
      await service.checkIn(TEST_ORG_ID, actorId, {});
      await service.checkIn(TEST_ORG_ID, TEAMMATE_USER_ID, {});
      const team = await service.list(TEST_ORG_ID, managerId, {}, 'team');
      const users = team.map((r) => r.userId).sort();
      expect(users).toEqual([SALESMAN_USER_ID, TEAMMATE_USER_ID].sort());
    });

    it('all shows every record in the org', async () => {
      await service.checkIn(TEST_ORG_ID, actorId, {});
      await service.checkIn(TEST_ORG_ID, ACCOUNTANT_USER_ID, {});
      const all = await service.list(TEST_ORG_ID, managerId, {}, 'all');
      expect(all.length).toBe(2);
    });

    it('team returns empty when actor manages nobody', async () => {
      await service.checkIn(TEST_ORG_ID, actorId, {});
      const team = await service.list(
        TEST_ORG_ID,
        ACCOUNTANT_USER_ID,
        {},
        'team',
      );
      expect(team).toEqual([]);
    });
  });

  describe('manual entry (manager corrections)', () => {
    it('records attendance for a reportee with explicit times', async () => {
      const checkin = at(2026, 8, 5, 10);
      const checkout = at(2026, 8, 5, 18);
      const record = await service.manualEntry(TEST_ORG_ID, managerId, {
        userId: SALESMAN_USER_ID,
        checkinAt: checkin.toISOString(),
        checkoutAt: checkout.toISOString(),
        remarks: 'field day',
      });
      expect(record.status).toBe('CLOSED');
      expect(record.source).toBe('MANUAL');
      expect(record.bsDate).toBe(bsKeyOf(checkin));
      expect(record.durationMinutes).toBe(480);
      expect(record.userId).toBe(SALESMAN_USER_ID);
    });

    it('leaves the record OPEN when no checkout is given', async () => {
      const checkin = at(2026, 8, 5, 10);
      const record = await service.manualEntry(TEST_ORG_ID, managerId, {
        userId: SALESMAN_USER_ID,
        checkinAt: checkin.toISOString(),
      });
      expect(record.status).toBe('OPEN');
      expect(record.checkoutAt).toBeNull();
    });

    it('rejects checkout before check-in', async () => {
      const checkin = at(2026, 8, 5, 18);
      const checkout = at(2026, 8, 5, 10);
      await expect(
        service.manualEntry(TEST_ORG_ID, managerId, {
          userId: SALESMAN_USER_ID,
          checkinAt: checkin.toISOString(),
          checkoutAt: checkout.toISOString(),
        }),
      ).rejects.toThrow(AttendanceInvalidCheckoutException);
    });

    it('rejects non-managers', async () => {
      await expect(
        service.manualEntry(TEST_ORG_ID, TEAMMATE_USER_ID, {
          userId: SALESMAN_USER_ID,
          checkinAt: at(2026, 8, 5, 10).toISOString(),
        }),
      ).rejects.toThrow(AttendanceNotReporteeException);
    });

    it('rejects manual entry while the reportee has an open record', async () => {
      await service.checkIn(TEST_ORG_ID, SALESMAN_USER_ID, {});
      await expect(
        service.manualEntry(TEST_ORG_ID, managerId, {
          userId: SALESMAN_USER_ID,
          checkinAt: at(2026, 8, 5, 10).toISOString(),
        }),
      ).rejects.toThrow(AttendanceOpenRecordConflictException);
    });
  });

  describe('adjust', () => {
    it('recomputes duration when checkout changes', async () => {
      const checkin = at(2026, 8, 5, 10);
      const checkout = at(2026, 8, 5, 18);
      const record = await service.manualEntry(TEST_ORG_ID, managerId, {
        userId: SALESMAN_USER_ID,
        checkinAt: checkin.toISOString(),
        checkoutAt: checkout.toISOString(),
      });
      const adjusted = await service.adjust(TEST_ORG_ID, managerId, record.id, {
        checkoutAt: at(2026, 8, 5, 17).toISOString(),
      });
      expect(adjusted.durationMinutes).toBe(420);
      expect(adjusted.status).toBe('CLOSED');
    });

    it('allows an owner to adjust their own record', async () => {
      const record = await service.manualEntry(TEST_ORG_ID, managerId, {
        userId: SALESMAN_USER_ID,
        checkinAt: at(2026, 8, 5, 10).toISOString(),
      });
      const adjusted = await service.adjust(
        TEST_ORG_ID,
        SALESMAN_USER_ID,
        record.id,
        {
          remarks: 'fixing note',
        },
      );
      expect(adjusted.checkinRemarks).toBe('fixing note');
    });

    it('rejects adjustment by someone who is neither owner nor manager', async () => {
      const record = await service.manualEntry(TEST_ORG_ID, managerId, {
        userId: SALESMAN_USER_ID,
        checkinAt: at(2026, 8, 5, 10).toISOString(),
      });
      await expect(
        service.adjust(TEST_ORG_ID, TEAMMATE_USER_ID, record.id, {
          remarks: 'nope',
        }),
      ).rejects.toThrow(AttendanceNotReporteeException);
    });

    it('throws when the record does not exist', async () => {
      await expect(
        service.adjust(
          TEST_ORG_ID,
          managerId,
          '00000000-0000-4000-8000-000000000000',
          {},
        ),
      ).rejects.toThrow(AttendanceNotFoundException);
    });
  });

  describe('reports', () => {
    it('daily report returns only records for the given BS date', async () => {
      const day1 = at(2026, 8, 5, 10);
      const day2 = at(2026, 8, 6, 10);
      await service.manualEntry(TEST_ORG_ID, managerId, {
        userId: SALESMAN_USER_ID,
        checkinAt: day1.toISOString(),
      });
      await service.manualEntry(TEST_ORG_ID, managerId, {
        userId: TEAMMATE_USER_ID,
        checkinAt: day2.toISOString(),
      });
      const report = await service.dailyReport(TEST_ORG_ID, managerId, {
        scope: 'team',
        bsDate: bsKeyOf(day1),
      });
      expect(report.bsDate).toBe(bsKeyOf(day1));
      expect(report.records.map((r) => r.userId)).toEqual([SALESMAN_USER_ID]);
    });

    it('monthly report aggregates present days, minutes and absences', async () => {
      const d1 = at(2026, 8, 5, 10);
      const d2 = at(2026, 8, 6, 9);
      await service.manualEntry(TEST_ORG_ID, managerId, {
        userId: TEAMMATE_USER_ID,
        checkinAt: d1.toISOString(),
        checkoutAt: at(2026, 8, 5, 18).toISOString(),
      });
      await service.manualEntry(TEST_ORG_ID, managerId, {
        userId: TEAMMATE_USER_ID,
        checkinAt: d2.toISOString(),
        checkoutAt: at(2026, 8, 6, 17).toISOString(),
      });

      const bs = converter.adToBs(
        d1.getFullYear(),
        d1.getMonth() + 1,
        d1.getDate(),
      );
      const report = await service.monthlyReport(TEST_ORG_ID, managerId, {
        scope: 'team',
        bsYear: bs.bsYear,
        bsMonth: bs.bsMonth,
      });
      const row = report.rows.find((r) => r.userId === TEAMMATE_USER_ID);
      expect(row).toBeDefined();
      expect(row!.presentDays).toBe(2);
      expect(row!.totalMinutes).toBe(960);
      expect(row!.avgMinutes).toBe(480);
      expect(row!.absences).toBe(report.monthDays - 2);
    });
  });
});
