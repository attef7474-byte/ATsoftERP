import { OPERATIONAL_RELIABILITY_PERMISSION_KEYS } from '../../src/modules/factory/operational-analytics/reliability/operational-reliability.constants';
import { OPERATIONAL_RELIABILITY_PERMISSIONS } from './seed-operational-reliability-permission-keys';
import { OPERATIONAL_RELIABILITY_SEED_PERMISSIONS } from './seed-operational-reliability-permissions';

const APPROVED_KEYS = [
  OPERATIONAL_RELIABILITY_PERMISSION_KEYS.read,
  OPERATIONAL_RELIABILITY_PERMISSION_KEYS.export,
];

describe('Operational reliability standalone permission seed (D-DB-4)', () => {
  it('registers exactly operational-reliability:read and operational-reliability:export', () => {
    expect(OPERATIONAL_RELIABILITY_SEED_PERMISSIONS.map((p) => p.key).sort()).toEqual([...APPROVED_KEYS].sort());
  });

  it('has exactly 2 unique keys', () => {
    expect(OPERATIONAL_RELIABILITY_SEED_PERMISSIONS).toHaveLength(2);
    expect(new Set(OPERATIONAL_RELIABILITY_SEED_PERMISSIONS.map((p) => p.key)).size).toBe(2);
  });

  it('does not include operational-reliability:classify', () => {
    expect(OPERATIONAL_RELIABILITY_SEED_PERMISSIONS.map((p) => p.key)).not.toContain('operational-reliability:classify');
  });

  it('does not include operational-reliability:approve', () => {
    expect(OPERATIONAL_RELIABILITY_SEED_PERMISSIONS.map((p) => p.key)).not.toContain('operational-reliability:approve');
  });

  it('derives module correctly for every key', () => {
    for (const p of OPERATIONAL_RELIABILITY_SEED_PERMISSIONS) {
      expect(p.module).toBe('operational-reliability');
    }
  });

  it('derives action correctly for every key', () => {
    for (const p of OPERATIONAL_RELIABILITY_SEED_PERMISSIONS) {
      const action = p.key.slice(p.key.lastIndexOf(':') + 1);
      expect(p.action).toBe(action);
      expect(p.action).toMatch(/^(read|export)$/);
    }
  });

  it('covers every permission enforced by the OperationalReliabilityController', () => {
    const seeded = new Set(OPERATIONAL_RELIABILITY_SEED_PERMISSIONS.map((p) => p.key));
    for (const key of APPROVED_KEYS) {
      expect(seeded.has(key)).toBe(true);
    }
  });

  it('introduces no reliability permission beyond the two approved keys', () => {
    const seeded = new Set(OPERATIONAL_RELIABILITY_SEED_PERMISSIONS.map((p) => p.key));
    for (const key of seeded) {
      expect(APPROVED_KEYS).toContain(key);
    }
  });

  it('matches the shared permission-keys component', () => {
    expect(OPERATIONAL_RELIABILITY_SEED_PERMISSIONS).toEqual(OPERATIONAL_RELIABILITY_PERMISSIONS);
  });

  it('importing the runner does not construct a Prisma client or open a DB connection', () => {
    jest.isolateModules(() => {
      const prismaClientMock = jest.fn();
      const prismaMssqlMock = jest.fn();
      jest.doMock('@prisma/client', () => ({ PrismaClient: prismaClientMock }));
      jest.doMock('@prisma/adapter-mssql', () => ({ PrismaMssql: prismaMssqlMock }));
      require('./seed-operational-reliability-permissions');
      expect(prismaClientMock).not.toHaveBeenCalled();
      expect(prismaMssqlMock).not.toHaveBeenCalled();
    });
  });
});
