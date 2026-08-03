import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const prisma = new PrismaClient({ adapter: new PrismaMssql(process.env.DATABASE_URL!) });

const tables = [
  "production_shifts",
  "production_shift_templates",
  "production_shift_template_days",
  "production_shift_calendars",
  "production_shift_calendar_entries",
  "production_shift_assignments",
  "production_operational_assignments",
];

async function main() {
  for (const t of tables) {
    const r = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM [dbo].[${t}]`);
    console.log(t, "rows=", (r as any)[0].c);
  }
  const seq = await prisma.numberSequence.count();
  console.log("numberSequences=", seq);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
