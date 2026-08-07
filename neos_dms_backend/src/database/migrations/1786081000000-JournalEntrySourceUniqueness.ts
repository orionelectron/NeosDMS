import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Guarantees a source document (sales invoice, purchase bill, …) can post at
 * most one journal entry per org. The existing org+source index is a plain
 * lookup index; this partial unique index makes retried document creation
 * (double posting) impossible at the schema level.
 */
export class JournalEntrySourceUniqueness1786081000000 implements MigrationInterface {
  name = 'JournalEntrySourceUniqueness1786081000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_journal_entries_source" ON "journal_entries"  ("organization_id", "source_type", "source_id") WHERE source_type IS NOT NULL AND source_id IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_journal_entries_source"`);
  }
}
