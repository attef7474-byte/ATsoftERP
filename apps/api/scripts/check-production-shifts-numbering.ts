import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const CODES = [
  "PRODUCTION_SHIFT",
  "PRODUCTION_SHIFT_TEMPLATE",
  "PRODUCTION_SHIFT_CALENDAR",
  "PRODUCTION_SHIFT_ASSIGNMENT",
  "PRODUCTION_OPERATIONAL_ASSIGNMENT",
];

async function main() {
  const rows = await prisma.numberSequence.findMany({
    where: { code: { in: CODES } },
    orderBy: { code: "asc" },
  });
  console.log(`Found ${rows.length}/${CODES.length} Phase 1.2 number sequences:`);
  for (const r of rows) {
    console.log(
      [
        r.code,
        r.prefix,
        `id=${r.id}`,
        `current=${r.currentNumber}`,
        `status=${r.status}`,
        `padding=${r.padding}`,
        `domain=${r.domain}`,
      ].join(" | "),
    );
  }
  const missing = CODES.filter((c) => !rows.some((r) => r.code === c));
  if (missing.length) console.log(`MISSING: ${missing.join(", ")}`);
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.code, (counts.get(r.code) ?? 0) + 1);
  const dupes = [...counts.entries()].filter(([, n]) => n > 1);
  console.log(dupes.length
    ? `DUPLICATE ROWS: ${dupes.map(([c, n]) => `${c} x${n}`).join(", ")}`
    : `No duplicate rows (1 row per code)`);
}

main()
  .catch((e) => {
    console.error("Check failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());