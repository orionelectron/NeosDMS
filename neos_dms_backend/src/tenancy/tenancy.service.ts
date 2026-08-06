import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SubscriptionEntity } from '../subscription/entities/subscription.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { BranchEntity } from './entities/branch.entity';
import { OrganizationEntity } from './entities/organization.entity';

export interface OnboardingResult {
  organization: OrganizationEntity;
  branch: BranchEntity;
  subscription: SubscriptionEntity;
}

@Injectable()
export class TenancyService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepo: Repository<OrganizationEntity>,
    @InjectRepository(BranchEntity)
    private readonly branchRepo: Repository<BranchEntity>,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  /**
   * Org onboarding hook: creates the organization + main branch + default
   * trial subscription in one transaction. Phase 3 will add the default COA
   * here (idempotently backfilled for pre-existing orgs by seed).
   */
  async onboard(dto: CreateOrganizationDto): Promise<OnboardingResult> {
    return this.dataSource.transaction(async (manager) => {
      const organization = await manager.save(
        manager.create(OrganizationEntity, {
          name: dto.name,
          legalName: dto.legalName ?? null,
          tradeName: dto.tradeName ?? null,
          email: dto.email,
          phoneNumber: dto.phoneNumber,
          panNumber: dto.panNumber,
          vatNumber: dto.vatNumber ?? null,
          logoUrl: dto.logoUrl ?? null,
          address: dto.address ?? null,
        }),
      );

      const branch = await manager.save(
        manager.create(BranchEntity, {
          organizationId: organization.id,
          name: dto.branchName ?? `${dto.name} Main`,
          code: dto.branchCode ?? 'MAIN',
          location: dto.branchLocation ?? null,
          isMainBranch: true,
          isActive: true,
        }),
      );

      const subscription = await this.subscriptionService.startTrial(
        organization.id,
        dto.planCode ?? 'starter',
        {
          periodName: dto.periodName ?? 'Monthly',
          manager,
        },
      );

      return { organization, branch, subscription };
    });
  }

  findById(id: string): Promise<OrganizationEntity | null> {
    return this.organizationRepo.findOne({
      where: { id },
      relations: { branches: true },
    });
  }

  findBranches(organizationId: string): Promise<BranchEntity[]> {
    return this.branchRepo.find({ where: { organizationId } });
  }
}
