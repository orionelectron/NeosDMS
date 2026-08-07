import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { NepaliDateConverter } from '../nepali-date/nepali-date-converter';
import {
  FiscalYearAlreadyExistsException,
  FiscalYearClosedException,
  FiscalYearNotFoundException,
  FiscalYearOverlapException,
  NoActiveFiscalYearException,
} from './accounting.errors';
import { FiscalPeriodEntity } from './entities/fiscal-period.entity';
import { FiscalYearEntity } from './entities/fiscal-year.entity';
import { buildFiscalYearPlan } from './provisioning.logic';

export interface CreateFiscalYearInput {
  bsYear: number;
  name?: string;
}

@Injectable()
export class FiscalYearService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(FiscalYearEntity)
    private readonly fyRepo: Repository<FiscalYearEntity>,
    @InjectRepository(FiscalPeriodEntity)
    private readonly periodRepo: Repository<FiscalPeriodEntity>,
    private readonly nepaliDate: NepaliDateConverter,
    private readonly auditService: AuditService,
  ) {}

  listFiscalYears(organizationId: string): Promise<FiscalYearEntity[]> {
    return this.fyRepo.find({
      where: { organizationId },
      relations: { periods: true },
      order: { startDate: 'DESC' },
    });
  }

  async getFiscalYear(
    organizationId: string,
    fiscalYearId: string,
  ): Promise<FiscalYearEntity> {
    const fiscalYear = await this.fyRepo.findOne({
      where: { id: fiscalYearId, organizationId },
      relations: { periods: true },
    });
    if (!fiscalYear) throw new FiscalYearNotFoundException(organizationId);
    return fiscalYear;
  }

  async getActiveFiscalYear(organizationId: string): Promise<FiscalYearEntity> {
    const fiscalYear = await this.fyRepo.findOne({
      where: { organizationId, isActive: true },
      relations: { periods: true },
    });
    if (!fiscalYear) throw new NoActiveFiscalYearException();
    return fiscalYear;
  }

  async createFiscalYear(
    organizationId: string,
    input: CreateFiscalYearInput,
    actorId: string,
  ): Promise<FiscalYearEntity> {
    const plan = buildFiscalYearPlan(input.bsYear, this.nepaliDate);
    const name = input.name ?? plan.name;

    const existingByName = await this.fyRepo.findOne({
      where: { organizationId, name },
    });
    if (existingByName) throw new FiscalYearAlreadyExistsException(name);

    const overlapping = await this.fyRepo
      .createQueryBuilder('fy')
      .where('fy.organizationId = :organizationId', { organizationId })
      .andWhere('fy.startDate <= :endDate', { endDate: plan.endDate })
      .andWhere('fy.endDate >= :startDate', { startDate: plan.startDate })
      .getOne();
    if (overlapping) throw new FiscalYearOverlapException(name);

    const existingCount = await this.fyRepo.count({
      where: { organizationId },
    });

    return this.dataSource.transaction(async (manager) => {
      const fyRepo = manager.getRepository(FiscalYearEntity);
      const periodRepo = manager.getRepository(FiscalPeriodEntity);

      const fiscalYear = await fyRepo.save(
        fyRepo.create({
          organizationId,
          name,
          startDate: plan.startDate,
          endDate: plan.endDate,
          isActive: existingCount === 0,
          isClosed: false,
          closedAt: null,
          closedBy: null,
        }),
      );

      await periodRepo.save(
        plan.periods.map((period) =>
          periodRepo.create({
            fiscalYearId: fiscalYear.id,
            name: period.name,
            sequence: period.sequence,
            startDateBs: period.startDateBs,
            endDateBs: period.endDateBs,
            startDate: period.startDate,
            endDate: period.endDate,
            isLocked: false,
            lockedAt: null,
            lockedBy: null,
          }),
        ),
      );

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'accounting.fiscal-year.create',
          entityType: 'fiscal-year',
          entityId: fiscalYear.id,
          newData: { name, startDate: plan.startDate, endDate: plan.endDate },
        },
        manager,
      );

      return this.getFiscalYear(organizationId, fiscalYear.id);
    });
  }

  async openFiscalYear(
    organizationId: string,
    fiscalYearId: string,
    actorId: string,
  ): Promise<FiscalYearEntity> {
    return this.dataSource.transaction(async (manager) => {
      const fyRepo = manager.getRepository(FiscalYearEntity);
      const fiscalYear = await fyRepo.findOne({
        where: { id: fiscalYearId, organizationId },
      });
      if (!fiscalYear) throw new FiscalYearNotFoundException(organizationId);
      if (fiscalYear.isClosed)
        throw new FiscalYearClosedException(fiscalYear.name);

      await fyRepo.update(
        { organizationId, id: Not(fiscalYearId) },
        { isActive: false },
      );
      await fyRepo.update({ id: fiscalYearId }, { isActive: true });

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'accounting.fiscal-year.update',
          entityType: 'fiscal-year',
          entityId: fiscalYearId,
          newData: { isActive: true, name: fiscalYear.name },
        },
        manager,
      );

      return this.getFiscalYear(organizationId, fiscalYearId);
    });
  }

  async closeFiscalYear(
    organizationId: string,
    fiscalYearId: string,
    actorId: string,
  ): Promise<FiscalYearEntity> {
    return this.dataSource.transaction(async (manager) => {
      const fyRepo = manager.getRepository(FiscalYearEntity);
      const periodRepo = manager.getRepository(FiscalPeriodEntity);
      const fiscalYear = await fyRepo.findOne({
        where: { id: fiscalYearId, organizationId },
      });
      if (!fiscalYear) throw new FiscalYearNotFoundException(organizationId);
      if (fiscalYear.isClosed)
        throw new FiscalYearClosedException(fiscalYear.name);

      fiscalYear.isClosed = true;
      fiscalYear.isActive = false;
      fiscalYear.closedAt = new Date();
      fiscalYear.closedBy = actorId;
      await fyRepo.save(fiscalYear);

      const now = new Date();
      await periodRepo.update(
        { fiscalYearId, isLocked: false },
        { isLocked: true, lockedAt: now, lockedBy: actorId },
      );

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'accounting.fiscal-year.close',
          entityType: 'fiscal-year',
          entityId: fiscalYearId,
          newData: { name: fiscalYear.name, closedAt: fiscalYear.closedAt },
        },
        manager,
      );

      return this.getFiscalYear(organizationId, fiscalYearId);
    });
  }

  async listPeriods(
    organizationId: string,
    fiscalYearId: string,
  ): Promise<FiscalPeriodEntity[]> {
    const fiscalYear = await this.fyRepo.findOne({
      where: { id: fiscalYearId, organizationId },
    });
    if (!fiscalYear) throw new FiscalYearNotFoundException(organizationId);
    return this.periodRepo.find({
      where: { fiscalYearId },
      order: { sequence: 'ASC' },
    });
  }
}
