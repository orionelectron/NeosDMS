import { randomUUID } from 'crypto';

type AnyEntity = { id?: string };

export function makeEntity<T extends object>(
  Entity: new () => T,
  data: Partial<T>,
): T {
  return Object.assign(Object.create(Entity.prototype as object) as T, data);
}

function valueMatches(
  item: Record<string, unknown>,
  key: string,
  value: unknown,
): boolean {
  const current = item[key];
  if (value && typeof value === 'object') {
    const op = (value as { _type?: string })._type;
    const operand = (value as { _value?: unknown })._value;
    if (op === 'in') return Array.isArray(operand) && operand.includes(current);
    if (op === 'isNull') return current === null || current === undefined;
    if (op === 'not') return current !== operand;
    if (op === 'lessThanOrEqual')
      return (
        current !== null &&
        current !== undefined &&
        (current as Date).getTime() <= (operand as Date).getTime()
      );
    if (op === 'moreThanOrEqual')
      return (
        current !== null &&
        current !== undefined &&
        (current as Date).getTime() >= (operand as Date).getTime()
      );
  }
  return current === value;
}

export function matchesWhere<T extends AnyEntity>(
  item: T,
  where: Record<string, unknown>,
): boolean {
  return Object.entries(where).every(([key, value]) =>
    valueMatches(item as unknown as Record<string, unknown>, key, value),
  );
}

export interface FakeManager {
  getRepository: jest.Mock;
  query: jest.Mock;
}

export interface FakeRepo<T extends AnyEntity = AnyEntity> {
  rows: T[];
  manager: FakeManager;
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  count: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  softDelete: jest.Mock;
  createQueryBuilder: jest.Mock;
}

interface QueryBuilder {
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getMany: jest.Mock;
  getManyAndCount: jest.Mock;
  getOne: jest.Mock;
}

function createQueryBuilder<T extends AnyEntity>(rows: T[]): QueryBuilder {
  const qb: QueryBuilder = {
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    addOrderBy: jest.fn(() => qb),
    skip: jest.fn(() => qb),
    take: jest.fn(() => qb),
    getMany: jest.fn(() => rows.slice()),
    getManyAndCount: jest.fn(
      () => [rows.slice(), rows.length] as [T[], number],
    ),
    getOne: jest.fn(() => null),
  };
  return qb;
}

function createRepo<T extends AnyEntity>(rows: T[]): FakeRepo<T> {
  return {
    rows,
    manager: undefined as unknown as FakeManager,
    create: jest.fn((data: Partial<T>) => ({ ...data }) as T),
    save: jest.fn((entity: T | T[]) => {
      const list = Array.isArray(entity) ? entity : [entity];
      for (const item of list) {
        if (!item.id) {
          item.id = randomUUID();
          rows.push(item);
        } else {
          const index = rows.findIndex((row) => row.id === item.id);
          if (index === -1) rows.push(item);
          else rows[index] = item;
        }
      }
      return entity;
    }),
    find: jest.fn(
      (options?: {
        where?: Record<string, unknown>;
        order?: Record<string, 'ASC' | 'DESC'>;
      }) => {
        const filtered = rows.filter((item) =>
          matchesWhere(item, options?.where ?? {}),
        );
        const order = options?.order;
        if (!order) return filtered;
        const key = Object.keys(order)[0];
        const direction = order[key];
        return filtered.slice().sort((a, b) => {
          const av = (a as unknown as Record<string, unknown>)[key] as
            string | number | Date;
          const bv = (b as unknown as Record<string, unknown>)[key] as
            string | number | Date;
          if (av === bv) return 0;
          const cmp = av > bv ? 1 : -1;
          return direction === 'DESC' ? -cmp : cmp;
        });
      },
    ),
    findOne: jest.fn(
      (options?: { where?: Record<string, unknown> }) =>
        rows.find((item) => matchesWhere(item, options?.where ?? {})) ?? null,
    ),
    count: jest.fn(
      (options?: { where?: Record<string, unknown> }) =>
        rows.filter((item) => matchesWhere(item, options?.where ?? {})).length,
    ),
    update: jest.fn(
      (criteria: Record<string, unknown>, patch: Record<string, unknown>) => {
        const matched = rows.filter((item) => matchesWhere(item, criteria));
        for (const item of matched) Object.assign(item, patch);
        return { affected: matched.length };
      },
    ),
    softDelete: jest.fn((criteria: Record<string, unknown>) => {
      const index = rows.findIndex((item) => matchesWhere(item, criteria));
      if (index !== -1) rows.splice(index, 1);
      return { affected: index !== -1 ? 1 : 0 };
    }),
    delete: jest.fn((criteria: Record<string, unknown>) => {
      const index = rows.findIndex((item) => matchesWhere(item, criteria));
      if (index !== -1) rows.splice(index, 1);
      return { affected: index !== -1 ? 1 : 0 };
    }),
    createQueryBuilder: jest.fn(() => createQueryBuilder(rows)),
  };
}

export interface FakeManagerBundle {
  manager: FakeManager;
  store: Map<new () => unknown, AnyEntity[]>;
  listFor: (Entity: new () => unknown) => AnyEntity[];
  repo: <T extends AnyEntity>(Entity: new () => unknown) => FakeRepo<T>;
}

export function createFakeManager(): FakeManagerBundle {
  const store = new Map<new () => unknown, AnyEntity[]>();
  const repos = new Map<new () => unknown, FakeRepo>();

  const listFor = (Entity: new () => unknown): AnyEntity[] => {
    if (!store.has(Entity)) store.set(Entity, []);
    return store.get(Entity) as AnyEntity[];
  };

  function getRepository(Entity: new () => unknown): FakeRepo {
    const existing = repos.get(Entity);
    if (existing) return existing;
    const repo = createRepo(listFor(Entity));
    repo.manager = manager;
    repos.set(Entity, repo);
    return repo;
  }

  const manager: FakeManager = {
    getRepository: jest.fn(getRepository),
    query: jest.fn(),
  };

  return {
    manager,
    store,
    listFor,
    repo: <T extends AnyEntity>(Entity: new () => unknown) =>
      manager.getRepository(Entity) as FakeRepo<T>,
  };
}
