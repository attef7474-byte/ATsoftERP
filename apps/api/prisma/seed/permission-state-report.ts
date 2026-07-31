import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PERMISSION_MIGRATIONS } from "./permission-sync";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const CANONICAL_KEYS = [
  "installed-parts:read",
  "maintenance-request:activity.view",
  "maintenance-request:attachments.view",
  "maintenance-request:print",
];

async function main() {
  const permissions = await prisma.permission.findMany({
    orderBy: { key: "asc" },
  });
  const assignments = await prisma.rolePermission.findMany();
  const roles = await prisma.role.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    orderBy: { code: "asc" },
  });

  const roleByCode = new Map(roles.map((role) => [role.id, role.code]));
  const canonical: Record<string, unknown>[] = [];
  const obsolete: Record<string, unknown>[] = [];

  for (const key of CANONICAL_KEYS) {
    const permission = permissions.find((entry) => entry.key === key);
    if (!permission) {
      canonical.push({ key, present: false });
      continue;
    }
    const linkedRoles = assignments
      .filter((assignment) => assignment.permissionId === permission.id)
      .map((assignment) => roleByCode.get(assignment.roleId) ?? assignment.roleId)
      .sort();
    canonical.push({
      key,
      present: true,
      id: permission.id,
      module: permission.module,
      action: permission.action,
      status: permission.status,
      linkedRoles,
      linkedRoleCount: linkedRoles.length,
    });
  }

  for (const migration of PERMISSION_MIGRATIONS) {
    const permission = permissions.find((entry) => entry.key === migration.oldKey);
    if (!permission) {
      obsolete.push({ key: migration.oldKey, present: false });
      continue;
    }
    const linkedRoles = assignments
      .filter((assignment) => assignment.permissionId === permission.id)
      .map((assignment) => roleByCode.get(assignment.roleId) ?? assignment.roleId)
      .sort();
    obsolete.push({
      key: migration.oldKey,
      present: true,
      id: permission.id,
      linkedRoles,
      linkedRoleCount: linkedRoles.length,
    });
  }

  const duplicateKeys = Object.entries(
    permissions.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.key] = (acc[entry.key] ?? 0) + 1;
      return acc;
    }, {}),
  ).filter(([, count]) => count > 1);

  const duplicateAssignments = Object.entries(
    assignments.reduce<Record<string, number>>((acc, entry) => {
      const pair = `${entry.roleId}|${entry.permissionId}`;
      acc[pair] = (acc[pair] ?? 0) + 1;
      return acc;
    }, {}),
  ).filter(([, count]) => count > 1);

  console.log(
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        totals: {
          permissions: permissions.length,
          rolePermissions: assignments.length,
          activeRoles: roles.length,
        },
        canonical,
        obsolete,
        duplicateKeys,
        duplicateAssignments,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Permission state report failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
