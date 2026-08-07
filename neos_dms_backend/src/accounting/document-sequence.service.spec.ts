import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import { DocumentSequenceEntity } from './entities/document-sequence.entity';
import { DocumentSequenceService } from './document-sequence.service';
import {
  createFakeManager,
  makeEntity,
  type FakeManager,
  type FakeRepo,
} from '../testing/accounting-fakes';

describe('DocumentSequenceService', () => {
  const orgId = 'org-1';

  let service: DocumentSequenceService;
  let manager: FakeManager;
  let seqRepo: FakeRepo<DocumentSequenceEntity>;

  beforeEach(async () => {
    const { manager: m, repo } = createFakeManager();
    manager = m;
    seqRepo = repo(DocumentSequenceEntity);

    const moduleRef = await Test.createTestingModule({
      providers: [
        DocumentSequenceService,
        {
          provide: getRepositoryToken(DocumentSequenceEntity),
          useValue: seqRepo,
        },
      ],
    }).compile();

    service = moduleRef.get(DocumentSequenceService);
  });

  describe('create', () => {
    it('persists a sequence with defaults', async () => {
      const seq = await service.create(orgId, {
        documentType: 'journal_entry',
      });

      expect(seq).toMatchObject({
        organizationId: orgId,
        branchId: null,
        fiscalYearId: null,
        documentType: 'journal_entry',
        prefix: null,
        lastNumber: 0,
      });
      expect(seqRepo.rows).toContainEqual(seq);
    });

    it('persists explicit branch, fiscal year, prefix and last number', async () => {
      const seq = await service.create(orgId, {
        documentType: 'sales_invoice',
        branchId: 'branch-1',
        fiscalYearId: 'fy-1',
        prefix: 'INV-',
        lastNumber: 41,
      });

      expect(seq).toMatchObject({
        branchId: 'branch-1',
        fiscalYearId: 'fy-1',
        prefix: 'INV-',
        lastNumber: 41,
      });
    });
  });

  describe('list', () => {
    it('returns sequences for the organization ordered by document type', async () => {
      seqRepo.rows.push(
        makeEntity(DocumentSequenceEntity, {
          id: 'seq-1',
          organizationId: orgId,
          documentType: 'journal_entry',
          lastNumber: 3,
        }),
      );

      const result = await service.list(orgId);

      expect(result.map((seq) => seq.documentType)).toEqual(['journal_entry']);
      expect(seqRepo.find).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        order: { documentType: 'ASC' },
      });
    });
  });

  describe('nextNumber', () => {
    it('returns the prefix plus the number padded to six digits', async () => {
      manager.query.mockResolvedValueOnce([{ last_number: 5, prefix: 'JE-' }]);

      const number = await service.nextNumber({
        organizationId: orgId,
        branchId: null,
        fiscalYearId: null,
        documentType: 'journal_entry',
        prefix: 'JE-',
      });

      expect(number).toBe('JE-000005');
      expect(manager.query).toHaveBeenCalledTimes(1);
    });

    it('uses the provided manager instead of the repo manager', async () => {
      const em = {
        query: jest
          .fn()
          .mockResolvedValue([{ last_number: 123, prefix: 'INV-' }]),
      };

      const number = await service.nextNumber(
        {
          organizationId: orgId,
          branchId: null,
          fiscalYearId: 'fy-1',
          documentType: 'sales_invoice',
          prefix: 'INV-',
        },
        em as unknown as EntityManager,
      );

      expect(number).toBe('INV-000123');
      expect(em.query).toHaveBeenCalledTimes(1);
      expect(manager.query).not.toHaveBeenCalled();
    });

    it('sends the atomic upsert SQL with the null-uuid sentinel and parameters', async () => {
      manager.query.mockResolvedValueOnce([{ last_number: 1, prefix: null }]);

      await service.nextNumber({
        organizationId: orgId,
        branchId: 'branch-1',
        fiscalYearId: null,
        documentType: 'journal_entry',
        prefix: null,
      });

      const call = manager.query.mock.calls[0] as [string, unknown[]];
      expect(call[0]).toContain('ON CONFLICT');
      expect(call[0]).toContain('00000000-0000-0000-0000-000000000000');
      expect(call[1]).toEqual([orgId, 'branch-1', null, 'journal_entry', null]);
    });

    it('uses the repo manager by default and handles a missing prefix', async () => {
      manager.query.mockResolvedValueOnce([{ last_number: 1, prefix: null }]);

      const number = await service.nextNumber({
        organizationId: orgId,
        branchId: null,
        fiscalYearId: null,
        documentType: 'journal_entry',
      });

      expect(number).toBe('000001');
    });
  });
});
