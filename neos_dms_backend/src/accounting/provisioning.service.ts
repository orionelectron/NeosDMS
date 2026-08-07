import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { provisionAccounting } from './provisioning.logic';

/**
 * Idempotent per-org accounting provisioning (COA, fiscal year + periods,
 * payment terms/methods, default tax codes). New orgs are provisioned
 * in-transaction during onboarding; this service backs the manual retry
 * endpoint and the backfill seed.
 */
@Injectable()
export class AccountingProvisioningService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async provision(
    organizationId: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (manager) {
      await provisionAccounting(manager, organizationId);
      return;
    }
    await this.dataSource.transaction((txn) =>
      provisionAccounting(txn, organizationId),
    );
  }
}
