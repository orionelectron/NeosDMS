# Backend Testing Handbook (NestJS + PostgreSQL)

> **Audience:** AI coding assistants and developers writing tests for this codebase.
> **Purpose:** Define what to mock, what to test against a real database, and why — so tests catch real bugs instead of passing against a fantasy version of the system.

---

## 1. Core Philosophy

The goal of testing is **confidence in production behavior**, not maximizing the number of unit tests.

- Prefer testing real behavior with real infrastructure when it provides meaningful confidence.
- Do not mock internal application layers just to make tests easier to write.
- A test that passes only because a dependency was mocked incorrectly is worse than no test at all.

**Default rule of thumb:**

> Before mocking something, ask: *"Would a production bug happen if this dependency behaved differently?"*
> - If **yes** → use the real dependency.
> - If **no** → mock it.

---

## 2. Testing Pyramid (Target Ratio)

This project intentionally inverts the traditional "mock everything" pyramid:

| Layer | Target Share | What it covers |
|---|---|---|
| Integration tests | **70%** | Services + repositories + real PostgreSQL |
| Unit tests | **25%** | Pure business logic only (no I/O) |
| E2E tests | **5%** | A few critical user flows end-to-end via HTTP |

Traditional (avoid this default): 80% mocked unit / 15% integration / 5% E2E.
This project's target: **80% integration / 15% unit / 5% E2E** — real infrastructure first.

---

## 3. Database Testing Rules

### 3.1 Default rule

If code touches PostgreSQL in any way, test it against a **real PostgreSQL container** — never a mocked repository.

**Bad:**
```typescript
jest.spyOn(repository, "findOne").mockResolvedValue(fakeOutlet)
```
This does not verify SQL correctness, relations, constraints, or migrations, and can hide real production bugs.

**Good:**
```
NestJS Service → Repository → Test PostgreSQL Container
```

### 3.2 Test environment lifecycle

```
Start container
      ↓
Run migrations
      ↓
Seed required data
      ↓
Execute tests
      ↓
Rollback changes
      ↓
Destroy container
```

Use a disposable container, e.g.:

```yaml
services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: test
      POSTGRES_DB: test_db
    ports:
      - "5433:5432"
```

### 3.3 Speed optimization: transaction rollback instead of full reset

Instead of recreating the database for every test, wrap each test in a transaction and roll it back:

```typescript
beforeEach(async () => {
  await prisma.$executeRaw`BEGIN`
})

afterEach(async () => {
  await prisma.$executeRaw`ROLLBACK`
})
```

This gives every test a clean database state without the cost of a full reset.

---

## 4. What MUST Use a Real Database

### 4.1 Repository tests

Examples: `OutletRepository`, `CustomerRepository`, `ProductRepository`, `InventoryRepository`, `OrderRepository`, `LedgerRepository`.

Test: create, update, delete, query filtering, pagination, relations, unique constraints, foreign keys.

```typescript
describe("OutletRepository", () => {
  it("creates outlet", async () => {
    const outlet = await repository.create({ name: "ABC Store" })
    expect(outlet.name).toBe("ABC Store")
  })
})
```

### 4.2 Transaction-heavy service logic

Example — creating a sales order:

```
BEGIN TRANSACTION
  1. create order
  2. reduce inventory
  3. create ledger entry
  4. update customer balance
COMMIT
```

Test: successful commit, rollback on failure, partial failure handling. **Never mock transactions.**

### 4.3 Database constraints

Examples: `UNIQUE(email)`, `FOREIGN KEY(outlet_id)`, `CHECK(quantity > 0)`, indexes used for filtering (e.g. by `organization_id`).

Only a real database can verify these actually hold.

### 4.4 ORM / Prisma queries

Test relations, `include`s, nested writes, transactions, and aggregations against a real database. ORM code is not business logic — it needs real verification, not a mock that assumes the query is correct.

---

## 5. What Should Be Unit Tested (No Database)

Pure business logic with no I/O. Examples:

```typescript
// VAT calculation
expect(calculateVAT(1000, 13)).toBe(130)
```

- **VAT / tax calculation**
- **Discount engine** (e.g. base discount + volume discount + seasonal discount)
- **Commission calculation** (`salesAmount * commissionRate`)
- **Permission / authorization rules** — when inputs are already available, no database needed

These are pure functions: fast, deterministic, no setup required.

---

## 6. What to Mock

| Category | Examples | Why |
|---|---|---|
| External APIs | Payment gateways (eSewa, Khalti), SMS providers, email providers, cloud storage, maps API | Slow, unreliable, expensive, outside our control |
| Time | Expiration checks, due dates, financial periods, reports | Need deterministic, fixed dates (e.g. `2026-01-01`) |
| Randomness | UUID generation, random numbers, tokens | Need deterministic output for assertions |
| File storage | S3, MinIO, cloud storage | Avoid real network/storage calls in tests |

---

## 7. What NOT to Mock

**Never mock internal services:**
```
OrderService → mocked InventoryService   ❌ (both belong to the same application)
```

**Never mock repositories:**
```
OrderService → mocked OrderRepository    ❌
OrderService → PostgreSQL (via repo)     ✅
```

**Never mock:**
- `PrismaClient` / TypeORM repositories directly
- Transactions
- Internal application services that belong to the same codebase

Mocking these makes the test verify an imaginary system instead of the real one.

---

## 8. NestJS Test Types

### Unit test
For `@Injectable()` classes containing **pure logic only** — e.g. `VatService`, `DiscountService`, `PricingService`. Dependencies may be mocked here since there's no I/O to verify.

### Integration test (default for most backend code)
For controllers, services, repositories, and modules. Use Nest's `TestingModule` + a real PostgreSQL instance.

```
OrderModule
  → Controller
  → Service
  → Repository
  → PostgreSQL
```

### E2E test
Reserved for a small number of critical user flows, exercised over HTTP:

```
HTTP request → NestJS Application → PostgreSQL
```

Examples: create customer, create order, receive payment, generate invoice.

---

## 9. Test Data Rules

Avoid large, hand-written fixture objects. Use minimal factories instead.

**Prefer:**
```typescript
createCustomer({ name: "Ram" })
```

**Avoid:**
```typescript
{
  id: "123",
  name: "Ram",
  address: "...",
  phone: "...",
  createdAt: "..."
}
```

Factories should produce the smallest valid object needed for the test.

---

## 10. Test Isolation Rules

- Every test must be independent — never rely on execution order (e.g. "test A must run before test B").
- Use **transaction rollback** (preferred, fast) or **database cleanup** between tests to guarantee isolation.

---

## 11. Priority Areas for This System (Distribution Management System)

| Domain | Approach |
|---|---|
| Accounting — ledger entries, double-entry validation, tax records, invoice generation | Real database |
| Inventory — stock movement, purchases, sales deduction, returns | Real database |
| Sales workflow — outlet → visit → order → inventory → invoice → payment | Real database |
| VAT / discount / commission formulas | Unit test |
| Payment gateway integration | Mock |

---

## 12. Decision Cheat Sheet

| Scenario | Decision |
|---|---|
| Repository query might be wrong | **Real database** |
| VAT/discount/commission formula might be wrong | **Unit test** |
| Payment provider might be unavailable | **Mock** |
| Stock transaction / transaction rollback might be wrong | **Real database** |
| Foreign key / unique constraint might be violated | **Real database** |
| Random ID / timestamp needs to be predictable | **Mock** |