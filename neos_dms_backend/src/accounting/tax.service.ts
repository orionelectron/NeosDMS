import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxCodeNotFoundException } from './accounting.errors';
import { TaxCodeEntity } from './entities/tax-code.entity';
import { TaxTemplateEntity } from './entities/tax-template.entity';
import { TaxTypeEntity } from './entities/tax-type.entity';

@Injectable()
export class TaxService {
  constructor(
    @InjectRepository(TaxTypeEntity)
    private readonly taxTypeRepo: Repository<TaxTypeEntity>,
    @InjectRepository(TaxTemplateEntity)
    private readonly taxTemplateRepo: Repository<TaxTemplateEntity>,
    @InjectRepository(TaxCodeEntity)
    private readonly taxCodeRepo: Repository<TaxCodeEntity>,
  ) {}

  listTaxTypes(): Promise<TaxTypeEntity[]> {
    return this.taxTypeRepo.find({ order: { name: 'ASC' } });
  }

  listTaxTemplates(): Promise<TaxTemplateEntity[]> {
    return this.taxTemplateRepo.find({
      relations: { taxType: true },
      order: { name: 'ASC' },
    });
  }

  listTaxCodes(organizationId: string): Promise<TaxCodeEntity[]> {
    return this.taxCodeRepo.find({
      where: { organizationId },
      relations: { taxType: true, account: true },
      order: { name: 'ASC' },
    });
  }

  async getTaxCode(
    organizationId: string,
    taxCodeId: string,
  ): Promise<TaxCodeEntity> {
    const taxCode = await this.taxCodeRepo.findOne({
      where: { id: taxCodeId, organizationId },
      relations: { taxType: true, account: true },
    });
    if (!taxCode) throw new TaxCodeNotFoundException(taxCodeId);
    return taxCode;
  }
}
