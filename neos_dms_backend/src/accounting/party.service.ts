import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { PartyKind } from './accounting.constants';
import {
  PartyNotFoundException,
  PartyRoleRequiredException,
} from './accounting.errors';
import { PartyAddressEntity } from './entities/party-address.entity';
import { PartyEntity } from './entities/party.entity';

export interface PartyAddressInput {
  addressType: string;
  addressLine1: string;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string;
  isDefault?: boolean;
}

export interface CreatePartyInput {
  name: string;
  partyKind?: PartyKind;
  isCustomer?: boolean;
  isSupplier?: boolean;
  isLead?: boolean;
  panNumber?: string | null;
  vatNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  creditLimit?: string | number;
  openingBalance?: string | number;
  paymentTermId?: string | null;
  branchId?: string | null;
  addresses?: PartyAddressInput[];
}

export interface UpdatePartyInput {
  name?: string;
  partyKind?: PartyKind;
  isCustomer?: boolean;
  isSupplier?: boolean;
  isLead?: boolean;
  panNumber?: string | null;
  vatNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  creditLimit?: string | number;
  openingBalance?: string | number;
  paymentTermId?: string | null;
  branchId?: string | null;
  isActive?: boolean;
}

export interface ListPartiesQuery {
  page: number;
  limit: number;
  role?: string;
  search?: string;
}

@Injectable()
export class PartyService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(PartyEntity)
    private readonly partyRepo: Repository<PartyEntity>,
    private readonly auditService: AuditService,
  ) {}

  async createParty(
    organizationId: string,
    input: CreatePartyInput,
    actorId: string,
  ): Promise<PartyEntity> {
    const isCustomer = input.isCustomer ?? false;
    const isSupplier = input.isSupplier ?? false;
    const isLead = input.isLead ?? false;
    if (!isCustomer && !isSupplier && !isLead) {
      throw new PartyRoleRequiredException();
    }

    return this.dataSource.transaction(async (manager) => {
      const partyRepo = manager.getRepository(PartyEntity);
      const party = await partyRepo.save(
        partyRepo.create({
          organizationId,
          branchId: input.branchId ?? null,
          currencyId: null,
          paymentTermId: input.paymentTermId ?? null,
          name: input.name,
          legalName: input.name,
          partyKind: input.partyKind ?? 'BUSINESS',
          isCustomer,
          isSupplier,
          isLead,
          panNumber: input.panNumber ?? null,
          vatNumber: input.vatNumber ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          address: input.address ?? null,
          creditLimit:
            input.creditLimit === undefined ? '0' : String(input.creditLimit),
          openingBalance:
            input.openingBalance === undefined
              ? '0'
              : String(input.openingBalance),
          isActive: true,
        }),
      );

      if (input.addresses && input.addresses.length > 0) {
        const addressRepo = manager.getRepository(PartyAddressEntity);
        await addressRepo.save(
          input.addresses.map((address) =>
            addressRepo.create({
              partyId: party.id,
              addressType: address.addressType,
              addressLine1: address.addressLine1,
              addressLine2: address.addressLine2 ?? null,
              city: address.city ?? null,
              state: address.state ?? null,
              zipCode: address.zipCode ?? null,
              country: address.country ?? 'Nepal',
              isDefault: address.isDefault ?? false,
            }),
          ),
        );
      }

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'accounting.party.create',
          entityType: 'party',
          entityId: party.id,
          newData: { name: party.name, partyKind: party.partyKind },
        },
        manager,
      );

      return this.loadPartyDetails(manager, organizationId, party.id);
    });
  }

  async listParties(
    organizationId: string,
    query: ListPartiesQuery,
  ): Promise<[PartyEntity[], number]> {
    const qb = this.partyRepo
      .createQueryBuilder('party')
      .where('party.organizationId = :organizationId', { organizationId });

    if (query.role === 'customer') {
      qb.andWhere('party.isCustomer = true');
    } else if (query.role === 'supplier') {
      qb.andWhere('party.isSupplier = true');
    } else if (query.role === 'lead') {
      qb.andWhere('party.isLead = true');
    }

    if (query.search) {
      qb.andWhere(
        '(party.name ILIKE :search OR party.email ILIKE :search OR party.phone ILIKE :search OR party.panNumber ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [rows, total] = await qb
      .orderBy('party.name', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return [rows, total];
  }

  async getParty(
    organizationId: string,
    partyId: string,
  ): Promise<PartyEntity> {
    const party = await this.partyRepo.findOne({
      where: { id: partyId, organizationId },
      relations: {
        addresses: true,
        paymentTerm: true,
      },
    });
    if (!party) throw new PartyNotFoundException(partyId);
    return party;
  }

  private async loadPartyDetails(
    manager: EntityManager,
    organizationId: string,
    partyId: string,
  ): Promise<PartyEntity> {
    const party = await manager.getRepository(PartyEntity).findOne({
      where: { id: partyId, organizationId },
      relations: {
        addresses: true,
        paymentTerm: true,
      },
    });
    if (!party) throw new PartyNotFoundException(partyId);
    return party;
  }

  async updateParty(
    organizationId: string,
    partyId: string,
    input: UpdatePartyInput,
    actorId: string,
  ): Promise<PartyEntity> {
    return this.dataSource.transaction(async (manager) => {
      const partyRepo = manager.getRepository(PartyEntity);
      const party = await partyRepo.findOne({
        where: { id: partyId, organizationId },
      });
      if (!party) throw new PartyNotFoundException(partyId);

      const nextCustomer = input.isCustomer ?? party.isCustomer;
      const nextSupplier = input.isSupplier ?? party.isSupplier;
      const nextLead = input.isLead ?? party.isLead;
      if (!nextCustomer && !nextSupplier && !nextLead) {
        throw new PartyRoleRequiredException();
      }

      Object.assign(party, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.partyKind !== undefined
          ? { partyKind: input.partyKind }
          : {}),
        ...(input.isCustomer !== undefined
          ? { isCustomer: input.isCustomer }
          : {}),
        ...(input.isSupplier !== undefined
          ? { isSupplier: input.isSupplier }
          : {}),
        ...(input.isLead !== undefined ? { isLead: input.isLead } : {}),
        ...(input.panNumber !== undefined
          ? { panNumber: input.panNumber }
          : {}),
        ...(input.vatNumber !== undefined
          ? { vatNumber: input.vatNumber }
          : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.creditLimit !== undefined
          ? { creditLimit: String(input.creditLimit) }
          : {}),
        ...(input.openingBalance !== undefined
          ? { openingBalance: String(input.openingBalance) }
          : {}),
        ...(input.paymentTermId !== undefined
          ? { paymentTermId: input.paymentTermId }
          : {}),
        ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      });
      const updated = await partyRepo.save(party);

      await this.auditService.record(
        {
          organizationId,
          userId: actorId,
          action: 'accounting.party.update',
          entityType: 'party',
          entityId: partyId,
          newData: { name: updated.name },
        },
        manager,
      );

      return updated;
    });
  }

  async deleteParty(
    organizationId: string,
    partyId: string,
    actorId: string,
  ): Promise<void> {
    const party = await this.partyRepo.findOne({
      where: { id: partyId, organizationId },
    });
    if (!party) throw new PartyNotFoundException(partyId);

    await this.partyRepo.softDelete({ id: partyId, organizationId });

    await this.auditService.record({
      organizationId,
      userId: actorId,
      action: 'accounting.party.delete',
      entityType: 'party',
      entityId: partyId,
      oldData: { name: party.name },
    });
  }
}
