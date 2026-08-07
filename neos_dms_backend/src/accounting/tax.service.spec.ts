import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaxCodeNotFoundException } from './accounting.errors';
import { TaxCodeEntity } from './entities/tax-code.entity';
import { TaxTemplateEntity } from './entities/tax-template.entity';
import { TaxTypeEntity } from './entities/tax-type.entity';
import { TaxService } from './tax.service';

describe('TaxService', () => {
  const orgId = 'org-1';

  let service: TaxService;
  let taxTypeRepo: { find: jest.Mock };
  let taxTemplateRepo: { find: jest.Mock };
  let taxCodeRepo: { find: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    taxTypeRepo = { find: jest.fn() };
    taxTemplateRepo = { find: jest.fn() };
    taxCodeRepo = { find: jest.fn(), findOne: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TaxService,
        { provide: getRepositoryToken(TaxTypeEntity), useValue: taxTypeRepo },
        {
          provide: getRepositoryToken(TaxTemplateEntity),
          useValue: taxTemplateRepo,
        },
        { provide: getRepositoryToken(TaxCodeEntity), useValue: taxCodeRepo },
      ],
    }).compile();

    service = moduleRef.get(TaxService);
  });

  it('lists tax types ordered by name', async () => {
    taxTypeRepo.find.mockResolvedValue([]);

    await service.listTaxTypes();

    expect(taxTypeRepo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
  });

  it('lists tax templates with their tax type relation', async () => {
    taxTemplateRepo.find.mockResolvedValue([]);

    await service.listTaxTemplates();

    expect(taxTemplateRepo.find).toHaveBeenCalledWith({
      relations: { taxType: true },
      order: { name: 'ASC' },
    });
  });

  it('lists tax codes scoped to the organization with relations', async () => {
    taxCodeRepo.find.mockResolvedValue([]);

    await service.listTaxCodes(orgId);

    expect(taxCodeRepo.find).toHaveBeenCalledWith({
      where: { organizationId: orgId },
      relations: { taxType: true, account: true },
      order: { name: 'ASC' },
    });
  });

  describe('getTaxCode', () => {
    it('returns the tax code with its relations', async () => {
      const code = { id: 'tax-1', organizationId: orgId, name: 'VAT 13%' };
      taxCodeRepo.findOne.mockResolvedValue(code);

      await expect(service.getTaxCode(orgId, 'tax-1')).resolves.toBe(code);
      expect(taxCodeRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'tax-1', organizationId: orgId },
        relations: { taxType: true, account: true },
      });
    });

    it('throws TaxCodeNotFoundException for an unknown code', async () => {
      taxCodeRepo.findOne.mockResolvedValue(null);

      await expect(service.getTaxCode(orgId, 'nope')).rejects.toThrow(
        TaxCodeNotFoundException,
      );
    });
  });
});
