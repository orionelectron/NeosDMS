# NEOS DMS Backend

NestJS 11 + TypeORM 1.x + PostgreSQL backend for NEOS DMS — a distribution
management system built for Nepal (NPR, VAT/TDS, Nepali fiscal year, dual
AD/BS dates).

## Stack

- **Framework:** NestJS 11 (TypeScript, `nodenext`, `strictNullChecks`)
- **ORM:** TypeORM 1.x with PostgreSQL (`jsonb`, partial unique indexes, CHECK constraints)
- **Validation:** `class-validator` + `class-transformer` (global `ValidationPipe`)
- **Config:** `@nestjs/config` with class-validator validation (fails fast on missing env vars)
- **Docs:** Swagger/OpenAPI mounted at `/api/v1/docs`
- **Cross-cutting:** CLS request IDs, structured response envelope, global exception filter

## Setup

```bash
npm install
cp .env.example .env
# create the database, e.g.:
#   createdb neos_dms
```

Required env vars (validated at boot): `DB_HOST`, `DB_PORT`, `DB_USER`,
`DB_PASSWORD`, `DB_NAME`. Optional: `NODE_ENV`, `PORT`.

## Run

```bash
npm run start:dev     # watch mode
npm run start:prod    # build then node dist/main
```

The API listens on `http://localhost:3000/api/v1` (Swagger at `/api/v1/docs`).
All responses are enveloped as `{ success, data, requestId }`; errors are
`{ status, code, message, details?, requestId }`. Every response carries an
`X-Request-Id` header (inbound value is honored).

## Database

`typeorm-ts-node-commonjs` is configured against `src/database/data-source.ts`
via the `typeorm` npm script. Migrations live in `src/database/migrations/`.

```bash
npm run typeorm -- migration:run       # apply pending migrations
npm run typeorm -- migration:show      # list applied/pending
npm run typeorm -- migration:revert    # revert last migration
npm run typeorm -- migration:generate  # generate from entity changes
```

`migration:generate` output is reviewed and committed; `synchronize` is never
enabled in production.

### Seeds

Seeders are versioned and idempotent: each seed runs exactly once inside a
transaction and is recorded in the `seed_versions` table.

```bash
npm run seed
```

Phase 0 ships the seed mechanism plus the permission-code catalog
(`src/database/seeders/permissions.ts`) as the single source of truth for
granular `Module.Resource.Action` permission codes. Base-role seeding is
added in Phase 2 when the IAM tables exist (`registry.ts`).

## Test

```bash
npm run lint        # eslint + prettier (--fix)
npm run test        # unit tests (no DB required)
npm run test:e2e    # e2e against the foundation wiring (no DB required)
```

Unit tests never touch a database. The e2e suite boots a lightweight module
(CLS, envelope/filter wiring, health, validation) so it stays green on CI
without Postgres.

## Conventions

- Each feature module: `*.module.ts`, `*.controller.ts`, `*.service.ts`,
  `entities/`, `dto/`, `*.spec.ts`. Entities colocated with features;
  migrations centralized in `src/database/migrations/`.
- DTOs everywhere; no `any` in new code; no inline comments unless they add
  context a reviewer can't infer.
- Commit message style: imperative, concise, prefixed by area
  (e.g. `feat(foundation): global validation, envelope, and exception filter`).
- Never commit `.env`; secrets only via environment.
