import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { DEFAULT_LOSS_REASONS } from "../../src/modules/factory/production-loss-reasons/production-loss-reasons.constants";

if (!process.env.SEED_ADMIN_EMAIL) {
  throw new Error("SEED_ADMIN_EMAIL environment variable is required");
}

export async function seedDefaultLossReasons(
  prisma: PrismaClient,
  companyId: string,
  branchId: string,
  userId: string,
): Promise<number> {
  let ensured = 0;
  for (const reason of DEFAULT_LOSS_REASONS) {
    await prisma.operationalLossReason.upsert({
      where: { companyId_branchId_code: { companyId, branchId, code: reason.code } },
      update: {},
      create: {
        companyId,
        branchId,
        code: reason.code,
        nameAr: reason.nameAr,
        nameEn: reason.nameEn,
        lossCategory: reason.lossCategory,
        plannedDefault: reason.plannedDefault,
        severityDefault: reason.severityDefault,
        maintenanceRequestPolicy: reason.maintenanceRequestPolicy,
        status: "ACTIVE",
        createdById: userId,
        updatedById: userId,
      },
    });
    ensured += 1;
  }
  console.log(`  Loss reasons: ${ensured} default reasons ensured for ${companyId}/${branchId}`);
  return ensured;
}

async function main() {
  const adapter = new PrismaMssql(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });
  try {
    const company = await prisma.company.findUniqueOrThrow({ where: { code: "DEFAULT" } });
    const branch = await prisma.branch.findFirstOrThrow({ where: { companyId: company.id, code: "HQ" } });
    const admin = await prisma.user.findFirstOrThrow({
      where: { email: process.env.SEED_ADMIN_EMAIL },
    });
    await seedDefaultLossReasons(prisma, company.id, branch.id, admin.id);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error("Default loss reasons seed failed:", e);
      process.exit(1);
    });
}
