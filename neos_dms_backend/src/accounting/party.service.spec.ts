import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from '../audit/audit.service';
import {
  PartyNotFoundException,
  PartyRoleRequiredException,
} from './accounting.errors';
import { PartyAddressEntity } from './entities/party-address.entity';
import { PartyEntity } from './entities/party.entity';
import { PartyService } from './party.service';
import {
  createFakeManager,
  makeEntity,
  type FakeManager,
  type FakeRepo,
} from '../testing/accounting-fakes';

describe('PartyService', () => {
  const orgId = 'org-1';
  const actorId = 'user-1';

  let service: PartyService;
  let manager: FakeManager;
  let getRepo: ReturnType<typeof createFakeManager>['repo'];
  let partyRepo: FakeRepo<PartyEntity>;
  let audit: { record: jest.Mock };

  const customer = () =>
    makeEntity(PartyEntity, {
      id: 'party-1',
      organizationId: orgId,
      name: 'Kathmandu Traders',
      partyKind: 'BUSINESS',
      isCustomer: true,
      isSupplier: false,
      isLead: false,
      isActive: true,
    });

  beforeEach(async () => {
    const { manager: m, repo } = createFakeManager();
    manager = m;
    getRepo = repo;
    partyRepo = repo(PartyEntity);
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const dataSource = {
      transaction: jest.fn((fn: (m: unknown) => unknown) => fn(manager)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PartyService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getRepositoryToken(PartyEntity), useValue: partyRepo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(PartyService);
  });

  describe('createParty', () => {
    it('throws PartyRoleRequiredException when no role is set', async () => {
      await expect(
        service.createParty(orgId, { name: 'Mystery Co' }, actorId),
      ).rejects.toThrow(PartyRoleRequiredException);
      expect(partyRepo.rows).toHaveLength(0);
    });

    it('creates a customer with defaults, addresses and audit', async () => {
      const party = await service.createParty(
        orgId,
        {
          name: 'Kathmandu Traders',
          isCustomer: true,
          creditLimit: 50000,
          addresses: [
            { addressType: 'BILLING', addressLine1: 'Baneshwor' },
            { addressType: 'SHIPPING', addressLine1: 'Thapathali' },
          ],
        },
        actorId,
      );

      expect(party).toMatchObject({
        organizationId: orgId,
        name: 'Kathmandu Traders',
        legalName: 'Kathmandu Traders',
        partyKind: 'BUSINESS',
        isCustomer: true,
        isSupplier: false,
        isLead: false,
        creditLimit: '50000',
        openingBalance: '0',
        isActive: true,
      });
      expect(party.id).toBeDefined();

      const addresses = getRepo(PartyAddressEntity).rows;
      expect(addresses).toHaveLength(2);
      expect(addresses.every((address) => address.partyId === party.id)).toBe(
        true,
      );
      expect(addresses[0].country).toBe('Nepal');

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'accounting.party.create' }),
        manager,
      );
    });

    it('coerces numeric balances to strings', async () => {
      const party = await service.createParty(
        orgId,
        { name: 'Lead Co', isLead: true, openingBalance: 250 },
        actorId,
      );

      expect(party.openingBalance).toBe('250');
      expect(party.creditLimit).toBe('0');
    });
  });

  describe('listParties', () => {
    it('wires role and search filters with pagination', async () => {
      const rows = [
        makeEntity(PartyEntity, {
          id: 'party-1',
          organizationId: orgId,
          name: 'A',
          isSupplier: true,
        }),
      ];
      const qb: {
        where: jest.Mock;
        andWhere: jest.Mock;
        orderBy: jest.Mock;
        skip: jest.Mock;
        take: jest.Mock;
        getManyAndCount: jest.Mock;
      } = {
        where: jest.fn(() => qb),
        andWhere: jest.fn(() => qb),
        orderBy: jest.fn(() => qb),
        skip: jest.fn(() => qb),
        take: jest.fn(() => qb),
        getManyAndCount: jest.fn(() => [rows, rows.length]),
      };
      partyRepo.createQueryBuilder.mockReturnValue(qb);

      const [result, total] = await service.listParties(orgId, {
        page: 2,
        limit: 10,
        role: 'supplier',
        search: 'trade',
      });

      expect(result).toBe(rows);
      expect(total).toBe(1);
      expect(qb.where).toHaveBeenCalledWith(
        'party.organizationId = :organizationId',
        { organizationId: orgId },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('party.isSupplier = true');
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('party.name ILIKE :search'),
        { search: '%trade%' },
      );
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
    });
  });

  describe('getParty', () => {
    it('returns a party with its relations', async () => {
      partyRepo.rows.push(customer());
      const party = await service.getParty(orgId, 'party-1');
      expect(party).toMatchObject({ id: 'party-1', isCustomer: true });
      expect(partyRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'party-1', organizationId: orgId },
          relations: { addresses: true, paymentTerm: true },
        }),
      );
    });

    it('throws PartyNotFoundException when missing', async () => {
      await expect(service.getParty(orgId, 'nope')).rejects.toThrow(
        PartyNotFoundException,
      );
    });
  });

  describe('updateParty', () => {
    it('updates fields and coerces balances', async () => {
      partyRepo.rows.push(customer());

      const updated = await service.updateParty(
        orgId,
        'party-1',
        { name: 'Renamed', creditLimit: 75000 },
        actorId,
      );

      expect(updated).toMatchObject({
        name: 'Renamed',
        creditLimit: '75000',
        isCustomer: true,
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'accounting.party.update' }),
        manager,
      );
    });

    it('throws PartyRoleRequiredException when unsetting the only role', async () => {
      partyRepo.rows.push(customer());

      await expect(
        service.updateParty(orgId, 'party-1', { isCustomer: false }, actorId),
      ).rejects.toThrow(PartyRoleRequiredException);
    });

    it('throws PartyNotFoundException when missing', async () => {
      await expect(
        service.updateParty(orgId, 'nope', { name: 'X' }, actorId),
      ).rejects.toThrow(PartyNotFoundException);
    });
  });

  describe('deleteParty', () => {
    it('soft-deletes and audits', async () => {
      partyRepo.rows.push(customer());

      await service.deleteParty(orgId, 'party-1', actorId);

      expect(partyRepo.rows).toHaveLength(0);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'accounting.party.delete' }),
      );
    });

    it('throws PartyNotFoundException when missing', async () => {
      await expect(service.deleteParty(orgId, 'nope', actorId)).rejects.toThrow(
        PartyNotFoundException,
      );
    });
  });
});
