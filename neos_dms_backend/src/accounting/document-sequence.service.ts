import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { DocumentSequenceEntity } from './entities/document-sequence.entity';

const NULL_UUID = '00000000-0000-0000-0000-000000000000';

export interface NextNumberInput {
  organizationId: string;
  branchId: string | null;
  fiscalYearId: string | null;
  documentType: string;
  prefix?: string | null;
}

export interface CreateSequenceInput {
  documentType: string;
  branchId?: string | null;
  fiscalYearId?: string | null;
  prefix?: string | null;
  lastNumber?: number;
}

/**
 * Per-scope running numbers backed by the `doc_seq_unique` expression index
 * on (organization_id, COALESCE(branch_id,<null-uuid>),
 * COALESCE(fiscal_year_id,<null-uuid>), document_type). The upsert increments
 * atomically, so concurrent calls never collide.
 */
@Injectable()
export class DocumentSequenceService {
  constructor(
    @InjectRepository(DocumentSequenceEntity)
    private readonly seqRepo: Repository<DocumentSequenceEntity>,
  ) {}

  list(organizationId: string): Promise<DocumentSequenceEntity[]> {
    return this.seqRepo.find({
      where: { organizationId },
      order: { documentType: 'ASC' },
    });
  }

  async create(
    organizationId: string,
    input: CreateSequenceInput,
  ): Promise<DocumentSequenceEntity> {
    return this.seqRepo.save(
      this.seqRepo.create({
        organizationId,
        branchId: input.branchId ?? null,
        fiscalYearId: input.fiscalYearId ?? null,
        documentType: input.documentType,
        prefix: input.prefix ?? null,
        lastNumber: input.lastNumber ?? 0,
      }),
    );
  }

  async nextNumber(
    input: NextNumberInput,
    manager?: EntityManager,
  ): Promise<string> {
    const em = manager ?? this.seqRepo.manager;
    const raw: unknown = await em.query(
      `INSERT INTO document_sequences
         (id, organization_id, branch_id, fiscal_year_id, document_type,
          prefix, last_number, "createdAt", "updatedAt")
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, 1, now(), now())
       ON CONFLICT (organization_id, COALESCE(branch_id, '${NULL_UUID}'),
                    COALESCE(fiscal_year_id, '${NULL_UUID}'), document_type)
       DO UPDATE SET last_number = document_sequences.last_number + 1,
                     "updatedAt" = now()
       RETURNING last_number, prefix`,
      [
        input.organizationId,
        input.branchId,
        input.fiscalYearId,
        input.documentType,
        input.prefix ?? null,
      ],
    );
    const rows = raw as Array<{
      last_number: number;
      prefix: string | null;
    }>;

    const row = rows[0];
    const prefix = row.prefix ?? '';
    const padded = String(row.last_number).padStart(6, '0');
    return `${prefix}${padded}`;
  }
}
