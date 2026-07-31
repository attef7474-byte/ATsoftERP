import type { PrismaClient } from "@prisma/client";

export const PERMISSION_MIGRATIONS: { oldKey: string; newKey: string }[] = [
  { oldKey: "maintenance-request:activity", newKey: "maintenance-request:activity.view" },
  { oldKey: "maintenance-request:attachments", newKey: "maintenance-request:attachments.view" },
  { oldKey: "maintenance-request:printData", newKey: "maintenance-request:print" },
];

export interface ExtraPermission {
  key: string;
  module: string;
  action: string;
}

export interface PermissionSyncResult {
  added: number;
  migrated: number;
  migrationDetails: {
    oldKey: string;
    newKey: string;
    reassignedRoles: number;
  }[];
}

export function deduplicateExtraPermissions(
  extraPermissions: ExtraPermission[],
): ExtraPermission[] {
  const seen = new Set<string>();
  const result: ExtraPermission[] = [];
  for (const entry of extraPermissions) {
    if (!entry?.key || seen.has(entry.key)) continue;
    seen.add(entry.key);
    result.push(entry);
  }
  return result;
}

export async function syncPermissionKeys(
  prisma: PrismaClient,
  extraPermissions: ExtraPermission[],
): Promise<PermissionSyncResult> {
  return prisma.$transaction(async (tx) => {
    const result: PermissionSyncResult = {
      added: 0,
      migrated: 0,
      migrationDetails: [],
    };

    const existingPermissions = await tx.permission.findMany();
    const existingAssignments = await tx.rolePermission.findMany();
    const permissionByKey = new Map(
      existingPermissions.map((permission) => [permission.key, permission]),
    );

    for (const migration of PERMISSION_MIGRATIONS) {
      const oldPermission = permissionByKey.get(migration.oldKey);
      if (!oldPermission) continue;

      const newPermission = await tx.permission.upsert({
        where: { key: migration.newKey },
        update: {},
        create: {
          key: migration.newKey,
          module: oldPermission.module,
          action: migration.newKey.split(":")[1] ?? migration.newKey,
          status: "ACTIVE",
        },
      });
      permissionByKey.set(migration.newKey, newPermission);

      const reassignedRoles = new Set<string>();
      const oldAssignments = existingAssignments.filter(
        (assignment) => assignment.permissionId === oldPermission.id,
      );
      for (const assignment of oldAssignments) {
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: assignment.roleId,
              permissionId: newPermission.id,
            },
          },
          update: {},
          create: {
            roleId: assignment.roleId,
            permissionId: newPermission.id,
          },
        });
        reassignedRoles.add(assignment.roleId);
      }

      if (oldPermission.id !== newPermission.id) {
        await tx.rolePermission.deleteMany({
          where: { permissionId: oldPermission.id },
        });
        await tx.permission.delete({ where: { id: oldPermission.id } });
        result.migrated += 1;
      }

      result.migrationDetails.push({
        oldKey: migration.oldKey,
        newKey: migration.newKey,
        reassignedRoles: reassignedRoles.size,
      });
    }

    for (const entry of deduplicateExtraPermissions(extraPermissions)) {
      if (permissionByKey.has(entry.key)) continue;
      const created = await tx.permission.create({
        data: {
          key: entry.key,
          module: entry.module,
          action: entry.action,
          status: "ACTIVE",
        },
      });
      permissionByKey.set(entry.key, created);
      result.added += 1;
    }

    return result;
  });
}
