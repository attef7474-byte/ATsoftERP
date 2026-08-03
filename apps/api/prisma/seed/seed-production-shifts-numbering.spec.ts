import {
  PRODUCTION_SHIFTS_NUMBER_SEQUENCES,
  seedProductionShiftsNumbering,
} from "./seed-production-shifts-numbering";

type NumberSequenceRecord = {
  code: string;
  prefix: string;
  currentNumber?: number;
  status?: string;
};

function makePrisma(existingByCode: Record<string, NumberSequenceRecord | null>) {
  const findUnique = jest.fn(({ where }: { where: { code: string } }) =>
    Promise.resolve(existingByCode[where.code] ?? null),
  );
  const create = jest.fn(({ data }: { data: NumberSequenceRecord }) => {
    existingByCode[data.code] = data;
    return Promise.resolve(data);
  });
  const prisma = {
    numberSequence: { findUnique, create },
  };
  return { prisma, findUnique, create };
}

describe("seedProductionShiftsNumbering", () => {
  it("exports exactly the five Phase 1.2 sequence keys and prefixes", () => {
    const byCode = Object.fromEntries(
      PRODUCTION_SHIFTS_NUMBER_SEQUENCES.map((s) => [s.code, s]),
    );
    expect(Object.keys(byCode).sort()).toEqual([
      "PRODUCTION_OPERATIONAL_ASSIGNMENT",
      "PRODUCTION_SHIFT",
      "PRODUCTION_SHIFT_ASSIGNMENT",
      "PRODUCTION_SHIFT_CALENDAR",
      "PRODUCTION_SHIFT_TEMPLATE",
    ]);
    expect(byCode.PRODUCTION_SHIFT.prefix).toBe("PS-");
    expect(byCode.PRODUCTION_SHIFT_TEMPLATE.prefix).toBe("PST-");
    expect(byCode.PRODUCTION_SHIFT_CALENDAR.prefix).toBe("PSC-");
    expect(byCode.PRODUCTION_SHIFT_ASSIGNMENT.prefix).toBe("PSA-");
    expect(byCode.PRODUCTION_OPERATIONAL_ASSIGNMENT.prefix).toBe("POA-");
    expect(byCode.PRODUCTION_SHIFT.status).toBe("ACTIVE");
  });

  it("creates all five sequences when none exist", async () => {
    const { prisma, findUnique, create } = makePrisma({});
    await seedProductionShiftsNumbering(prisma as any);

    expect(findUnique).toHaveBeenCalledTimes(5);
    expect(create).toHaveBeenCalledTimes(5);
    const createdCodes = create.mock.calls.map((c) => c[0].data.code);
    expect(createdCodes.sort()).toEqual([
      "PRODUCTION_OPERATIONAL_ASSIGNMENT",
      "PRODUCTION_SHIFT",
      "PRODUCTION_SHIFT_ASSIGNMENT",
      "PRODUCTION_SHIFT_CALENDAR",
      "PRODUCTION_SHIFT_TEMPLATE",
    ]);
  });

  it("does not duplicate existing sequences and preserves their counters", async () => {
    const existing: Record<string, NumberSequenceRecord> = {
      PRODUCTION_SHIFT: { code: "PRODUCTION_SHIFT", prefix: "PS-", currentNumber: 42, status: "ACTIVE" },
      PRODUCTION_SHIFT_TEMPLATE: { code: "PRODUCTION_SHIFT_TEMPLATE", prefix: "PST-", currentNumber: 7, status: "ACTIVE" },
      PRODUCTION_SHIFT_CALENDAR: { code: "PRODUCTION_SHIFT_CALENDAR", prefix: "PSC-", currentNumber: 3, status: "ACTIVE" },
      PRODUCTION_SHIFT_ASSIGNMENT: { code: "PRODUCTION_SHIFT_ASSIGNMENT", prefix: "PSA-", currentNumber: 11, status: "ACTIVE" },
      PRODUCTION_OPERATIONAL_ASSIGNMENT: { code: "PRODUCTION_OPERATIONAL_ASSIGNMENT", prefix: "POA-", currentNumber: 5, status: "ACTIVE" },
    };
    const { prisma, findUnique, create } = makePrisma(existing);
    await seedProductionShiftsNumbering(prisma as any);

    expect(findUnique).toHaveBeenCalledTimes(5);
    expect(create).not.toHaveBeenCalled();
    expect(existing.PRODUCTION_SHIFT.currentNumber).toBe(42);
    expect(existing.PRODUCTION_OPERATIONAL_ASSIGNMENT.currentNumber).toBe(5);
  });

  it("is idempotent: rerunning with all existing sequences creates nothing and keeps counters", async () => {
    const existing: Record<string, NumberSequenceRecord> = {
      PRODUCTION_SHIFT: { code: "PRODUCTION_SHIFT", prefix: "PS-", currentNumber: 42, status: "ACTIVE" },
      PRODUCTION_SHIFT_TEMPLATE: { code: "PRODUCTION_SHIFT_TEMPLATE", prefix: "PST-", currentNumber: 7, status: "ACTIVE" },
      PRODUCTION_SHIFT_CALENDAR: { code: "PRODUCTION_SHIFT_CALENDAR", prefix: "PSC-", currentNumber: 3, status: "ACTIVE" },
      PRODUCTION_SHIFT_ASSIGNMENT: { code: "PRODUCTION_SHIFT_ASSIGNMENT", prefix: "PSA-", currentNumber: 11, status: "ACTIVE" },
      PRODUCTION_OPERATIONAL_ASSIGNMENT: { code: "PRODUCTION_OPERATIONAL_ASSIGNMENT", prefix: "POA-", currentNumber: 5, status: "ACTIVE" },
    };
    const { prisma, findUnique, create } = makePrisma(existing);

    await seedProductionShiftsNumbering(prisma as any);
    await seedProductionShiftsNumbering(prisma as any);

    expect(findUnique).toHaveBeenCalledTimes(10);
    expect(create).not.toHaveBeenCalled();
    expect(existing.PRODUCTION_SHIFT.currentNumber).toBe(42);
  });

  it("creates only the missing sequences in a mixed state and preserves existing counters", async () => {
    const existing: Record<string, NumberSequenceRecord> = {
      PRODUCTION_SHIFT: { code: "PRODUCTION_SHIFT", prefix: "PS-", currentNumber: 42, status: "ACTIVE" },
    };
    const { prisma, findUnique, create } = makePrisma(existing);

    await seedProductionShiftsNumbering(prisma as any);

    expect(findUnique).toHaveBeenCalledTimes(5);
    expect(create).toHaveBeenCalledTimes(4);
    expect(existing.PRODUCTION_SHIFT.currentNumber).toBe(42);
    const createdCodes = create.mock.calls.map((c) => c[0].data.code);
    expect(createdCodes).not.toContain("PRODUCTION_SHIFT");
  });

  it("surfaces database failures instead of swallowing them", async () => {
    const findUnique = jest.fn(() => Promise.reject(new Error("db unavailable")));
    const prisma = { numberSequence: { findUnique, create: jest.fn() } };
    await expect(seedProductionShiftsNumbering(prisma as any)).rejects.toThrow(
      "db unavailable",
    );
  });
});
