import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const OPERATION_TYPES = [
  { code: "MANUFACTURING", name: "Manufacturing", nameAr: "تصنيع", description: "Manufacturing and production operations" },
  { code: "PREPARATION", name: "Preparation", nameAr: "تحضير", description: "Material preparation and setup operations" },
  { code: "MIXING", name: "Mixing", nameAr: "خلط", description: "Mixing and blending operations" },
  { code: "FILLING", name: "Filling", nameAr: "تعبئة", description: "Filling and packaging operations" },
  { code: "PACKAGING", name: "Packaging", nameAr: "تغليف", description: "Packaging and labeling operations" },
  { code: "UTILITIES", name: "Utilities", nameAr: "خدمات مساندة", description: "Utility and facility support operations" },
  { code: "MAINTENANCE", name: "Maintenance", nameAr: "صيانة", description: "Maintenance and repair operations" },
  { code: "QUALITY", name: "Quality", nameAr: "جودة", description: "Quality control and assurance operations" },
  { code: "PROJECT", name: "Project / Development", nameAr: "مشروع / تطوير", description: "Project and development operations" },
];

const COST_CENTERS = [
  { code: "PRODUCTION-GENERAL", name: "Production Cost Center", nameAr: "مركز تكلفة إنتاج", type: "PRODUCTION" },
  { code: "MAINTENANCE-GENERAL", name: "Maintenance Cost Center", nameAr: "مركز تكلفة صيانة", type: "MAINTENANCE" },
  { code: "PROJECTS-GENERAL", name: "Projects Cost Center", nameAr: "مركز تكلفة مشاريع", type: "PROJECT" },
  { code: "DEVELOPMENT-GENERAL", name: "Development Cost Center", nameAr: "مركز تكلفة تطوير", type: "DEVELOPMENT" },
  { code: "UTILITIES-GENERAL", name: "Utilities Cost Center", nameAr: "مركز تكلفة خدمات", type: "UTILITIES" },
  { code: "QUALITY-GENERAL", name: "Quality Cost Center", nameAr: "مركز تكلفة جودة", type: "QUALITY" },
];

async function main() {
  let created = 0;

  for (const ot of OPERATION_TYPES) {
    await prisma.operationType.upsert({
      where: { code: ot.code },
      update: {},
      create: { code: ot.code, name: ot.name, description: ot.description, status: "ACTIVE" },
    });
    created++;
  }

  for (const cc of COST_CENTERS) {
    await prisma.costCenter.upsert({
      where: { code: cc.code },
      update: {},
      create: { code: cc.code, name: cc.name, type: cc.type, status: "ACTIVE" },
    });
    created++;
  }

  console.log(`Factory reference seed completed: ${created} records created/verified.`);
  console.log(`  Operation Types: ${OPERATION_TYPES.length}`);
  console.log(`  Cost Centers:    ${COST_CENTERS.length}`);
}

main()
  .catch((e) => {
    console.error("Factory reference seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
