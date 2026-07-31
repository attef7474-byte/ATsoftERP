import type { PrismaClient } from "@prisma/client";
import {
  PERMISSION_MIGRATIONS,
  syncPermissionKeys,
  deduplicateExtraPermissions,
} from "../../../prisma/seed/permission-sync";

interface FakePermission {
  id: string;
  key: string;
  module: string;
  action: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FakeRolePermission {
  roleId: string;
  permissionId: string;
}

class FakePrisma {
  private nextId = 1;
  private permissions = new Map<string, FakePermission>();
  private rolePermissions = new Map<string, FakeRolePermission>();

  seedPermission(
    data: Pick<FakePermission, "key" | "module" | "action"> &
      Partial<Pick<FakePermission, "id" | "status">>,
  ): FakePermission {
    const id = data.id ?? `p${this.nextId++}`;
    const row: FakePermission = {
      id,
      key: data.key,
      module: data.module,
      action: data.action,
      status: data.status ?? "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.permissions.set(id, row);
    return row;
  }

  seedRolePermission(roleId: string, permissionId: string): void {
    this.rolePermissions.set(`${roleId}|${permissionId}`, {
      roleId,
      permissionId,
    });
  }

  listPermissions(): FakePermission[] {
    return Array.from(this.permissions.values());
  }

  listRolePermissions(): FakeRolePermission[] {
    return Array.from(this.rolePermissions.values());
  }

  permission = {
    findMany: async (): Promise<FakePermission[]> =>
      Array.from(this.permissions.values()),
    findUnique: async (args: {
      where: { key: string };
    }): Promise<FakePermission | null> =>
      Array.from(this.permissions.values()).find(
        (entry) => entry.key === args.where.key,
      ) ?? null,
    upsert: async (args: {
      where: { key: string };
      update: Record<string, unknown>;
      create: Pick<FakePermission, "key" | "module" | "action" | "status">;
    }): Promise<FakePermission> => {
      const existing = Array.from(this.permissions.values()).find(
        (entry) => entry.key === args.where.key,
      );
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      const id = `p${this.nextId++}`;
      const row: FakePermission = {
        id,
        key: args.create.key,
        module: args.create.module,
        action: args.create.action,
        status: args.create.status ?? "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.permissions.set(id, row);
      return row;
    },
    create: async (args: {
      data: Pick<FakePermission, "key" | "module" | "action" | "status">;
    }): Promise<FakePermission> => {
      const id = `p${this.nextId++}`;
      const row: FakePermission = {
        id,
        key: args.data.key,
        module: args.data.module,
        action: args.data.action,
        status: args.data.status ?? "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.permissions.set(id, row);
      return row;
    },
    delete: async (args: { where: { id: string } }): Promise<FakePermission> => {
      const row = this.permissions.get(args.where.id);
      if (!row) throw new Error(`permission.delete: not found (${args.where.id})`);
      this.permissions.delete(args.where.id);
      return row;
    },
  };

  rolePermission = {
    findMany: async (args?: {
      where?: { permissionId?: string; roleId?: string };
    }): Promise<FakeRolePermission[]> => {
      const where = args?.where ?? {};
      return Array.from(this.rolePermissions.values()).filter(
        (entry) =>
          (!where.permissionId || entry.permissionId === where.permissionId) &&
          (!where.roleId || entry.roleId === where.roleId),
      );
    },
    upsert: async (args: {
      where: { roleId_permissionId: { roleId: string; permissionId: string } };
      create: { roleId: string; permissionId: string };
    }): Promise<FakeRolePermission> => {
      const { roleId, permissionId } = args.where.roleId_permissionId;
      const key = `${roleId}|${permissionId}`;
      const existing = this.rolePermissions.get(key);
      if (existing) return existing;
      const row = {
        roleId: args.create.roleId,
        permissionId: args.create.permissionId,
      };
      this.rolePermissions.set(key, row);
      return row;
    },
    deleteMany: async (args: {
      where: { permissionId?: string; roleId?: string };
    }): Promise<{ count: number }> => {
      let count = 0;
      for (const [key, entry] of this.rolePermissions) {
        if (
          args.where.permissionId &&
          entry.permissionId !== args.where.permissionId
        ) {
          continue;
        }
        if (args.where.roleId && entry.roleId !== args.where.roleId) continue;
        this.rolePermissions.delete(key);
        count += 1;
      }
      return { count };
    },
  };

  $transaction = async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> =>
    fn(this);
}

const CANONICAL: {
  key: string;
  module: string;
  action: string;
}[] = [
  { key: "installed-parts:read", module: "installed-parts", action: "read" },
  {
    key: "maintenance-request:activity.view",
    module: "maintenance-request",
    action: "activity.view",
  },
  {
    key: "maintenance-request:attachments.view",
    module: "maintenance-request",
    action: "attachments.view",
  },
  { key: "maintenance-request:print", module: "maintenance-request", action: "print" },
];

describe("syncPermissionKeys (permission database synchronization)", () => {
  it("adds all missing canonical permissions when the database is empty", async () => {
    const db = new FakePrisma();

    const result = await syncPermissionKeys(
      db as unknown as PrismaClient,
      CANONICAL,
    );

    expect(result.added).toBe(4);
    expect(result.migrated).toBe(0);
    const keys = db.listPermissions().map((entry) => entry.key);
    for (const canonical of CANONICAL) {
      expect(keys).toContain(canonical.key);
    }
    const created = db
      .listPermissions()
      .find((entry) => entry.key === "installed-parts:read");
    expect(created?.module).toBe("installed-parts");
    expect(created?.status).toBe("ACTIVE");
  });

  it("keeps existing canonical permissions unchanged and reports zero additions", async () => {
    const db = new FakePrisma();
    const existing = db.seedPermission({
      key: "installed-parts:read",
      module: "installed-parts",
      action: "read",
      id: "existing-id",
    });
    db.seedPermission({
      key: "maintenance-request:activity.view",
      module: "maintenance-request",
      action: "activity.view",
    });
    db.seedPermission({
      key: "maintenance-request:attachments.view",
      module: "maintenance-request",
      action: "attachments.view",
    });
    db.seedPermission({
      key: "maintenance-request:print",
      module: "maintenance-request",
      action: "print",
    });

    const result = await syncPermissionKeys(
      db as unknown as PrismaClient,
      CANONICAL,
    );

    expect(result.added).toBe(0);
    expect(db.listPermissions().map((entry) => entry.id)).toContain(
      existing.id,
    );
    expect(
      db.listPermissions().find((entry) => entry.id === existing.id)?.action,
    ).toBe("read");
  });

  it("migrates an obsolete key and re-points role assignments to the canonical key", async () => {
    const db = new FakePrisma();
    const obsolete = db.seedPermission({
      key: "maintenance-request:activity",
      module: "maintenance-request",
      action: "activity",
      id: "obsolete-1",
    });
    db.seedRolePermission("role-technician", obsolete.id);
    db.seedRolePermission("role-supervisor", obsolete.id);
    db.seedRolePermission("role-technician", "unrelated-permission");

    const result = await syncPermissionKeys(
      db as unknown as PrismaClient,
      CANONICAL,
    );

    expect(result.migrated).toBe(1);
    expect(result.migrationDetails[0]).toMatchObject({
      oldKey: "maintenance-request:activity",
      newKey: "maintenance-request:activity.view",
      reassignedRoles: 2,
    });
    expect(
      db.listPermissions().some((entry) => entry.key === "maintenance-request:activity"),
    ).toBe(false);
    const newPermission = db
      .listPermissions()
      .find((entry) => entry.key === "maintenance-request:activity.view");
    expect(newPermission).toBeDefined();
    const assignments = db.listRolePermissions();
    expect(
      assignments.some(
        (entry) =>
          entry.roleId === "role-technician" &&
          entry.permissionId === newPermission!.id,
      ),
    ).toBe(true);
    expect(
      assignments.some(
        (entry) =>
          entry.roleId === "role-supervisor" &&
          entry.permissionId === newPermission!.id,
      ),
    ).toBe(true);
    expect(
      assignments.some((entry) => entry.permissionId === obsolete.id),
    ).toBe(false);
    expect(
      assignments.some(
        (entry) =>
          entry.roleId === "role-technician" &&
          entry.permissionId === "unrelated-permission",
      ),
    ).toBe(true);
  });

  it("does not modify unrelated permissions or role assignments", async () => {
    const db = new FakePrisma();
    const unrelated = db.seedPermission({
      key: "unrelated:read",
      module: "unrelated",
      action: "read",
    });
    db.seedRolePermission("role-other", unrelated.id);

    const result = await syncPermissionKeys(
      db as unknown as PrismaClient,
      CANONICAL,
    );

    expect(result.migrated).toBe(0);
    expect(result.added).toBe(4);
    expect(
      db.listPermissions().find((entry) => entry.key === "unrelated:read")?.id,
    ).toBe(unrelated.id);
    expect(db.listRolePermissions()).toHaveLength(1);
    expect(db.listRolePermissions()[0].permissionId).toBe(unrelated.id);
  });

  it("preserves the canonical row when both canonical and obsolete keys exist", async () => {
    const db = new FakePrisma();
    const canonical = db.seedPermission({
      key: "maintenance-request:print",
      module: "maintenance-request",
      action: "print",
      id: "canonical-print",
    });
    const obsolete = db.seedPermission({
      key: "maintenance-request:printData",
      module: "maintenance-request",
      action: "printData",
      id: "obsolete-print",
    });
    db.seedRolePermission("role-1", canonical.id);
    db.seedRolePermission("role-2", obsolete.id);

    const result = await syncPermissionKeys(
      db as unknown as PrismaClient,
      CANONICAL,
    );

    expect(result.migrated).toBe(1);
    const print = db
      .listPermissions()
      .find((entry) => entry.key === "maintenance-request:print");
    expect(print?.id).toBe("canonical-print");
    expect(
      db.listPermissions().some((entry) => entry.key === "maintenance-request:printData"),
    ).toBe(false);
    const roleOne = db.listRolePermissions().find((entry) => entry.roleId === "role-1");
    const roleTwo = db.listRolePermissions().find((entry) => entry.roleId === "role-2");
    expect(roleOne?.permissionId).toBe("canonical-print");
    expect(roleTwo?.permissionId).toBe("canonical-print");
  });

  it("is idempotent when executed twice on the same database", async () => {
    const db = new FakePrisma();
    const obsolete = db.seedPermission({
      key: "maintenance-request:attachments",
      module: "maintenance-request",
      action: "attachments",
    });
    db.seedRolePermission("role-1", obsolete.id);

    const first = await syncPermissionKeys(
      db as unknown as PrismaClient,
      CANONICAL,
    );
    const before = JSON.stringify(db.listPermissions());

    const second = await syncPermissionKeys(
      db as unknown as PrismaClient,
      CANONICAL,
    );

    expect(first.added).toBe(3);
    expect(first.migrated).toBe(1);
    expect(second.added).toBe(0);
    expect(second.migrated).toBe(0);
    expect(second.migrationDetails).toHaveLength(0);
    expect(JSON.stringify(db.listPermissions())).toBe(before);
  });

  it("deduplicates the extra permission input list", async () => {
    const db = new FakePrisma();

    const result = await syncPermissionKeys(db as unknown as PrismaClient, [
      ...CANONICAL,
      ...CANONICAL,
      CANONICAL[0],
    ]);

    expect(result.added).toBe(4);
    expect(db.listPermissions().length).toBe(4);
  });

  it("merges assignments when the new key already exists before migration", async () => {
    const db = new FakePrisma();
    const obsolete = db.seedPermission({
      key: "maintenance-request:activity",
      module: "maintenance-request",
      action: "activity",
      id: "obsolete-existing",
    });
    const canonical = db.seedPermission({
      key: "maintenance-request:activity.view",
      module: "maintenance-request",
      action: "activity.view",
      id: "canonical-existing",
    });
    db.seedRolePermission("role-a", canonical.id);
    db.seedRolePermission("role-b", obsolete.id);
    db.seedRolePermission("role-c", obsolete.id);

    const result = await syncPermissionKeys(
      db as unknown as PrismaClient,
      CANONICAL,
    );

    expect(result.migrated).toBe(1);
    const canonicalNow = db
      .listPermissions()
      .find((entry) => entry.key === "maintenance-request:activity.view");
    expect(canonicalNow?.id).toBe("canonical-existing");
    const pairs = db
      .listRolePermissions()
      .filter((entry) => entry.permissionId === "canonical-existing")
      .map((entry) => entry.roleId)
      .sort();
    expect(pairs).toEqual(["role-a", "role-b", "role-c"]);
    expect(
      db.listRolePermissions().filter((entry) => entry.permissionId === "obsolete-existing"),
    ).toHaveLength(0);
  });

  it("migrates all three obsolete maintenance-request keys", async () => {
    const db = new FakePrisma();
    for (const migration of PERMISSION_MIGRATIONS) {
      const obsolete = db.seedPermission({
        key: migration.oldKey,
        module: "maintenance-request",
        action: migration.oldKey.split(":")[1] ?? migration.oldKey,
      });
      db.seedRolePermission("role-x", obsolete.id);
    }

    const result = await syncPermissionKeys(
      db as unknown as PrismaClient,
      CANONICAL,
    );

    expect(result.migrated).toBe(3);
    expect(result.migrationDetails).toHaveLength(3);
    for (const migration of PERMISSION_MIGRATIONS) {
      expect(
        db.listPermissions().some((entry) => entry.key === migration.oldKey),
      ).toBe(false);
      expect(
        db.listPermissions().some((entry) => entry.key === migration.newKey),
      ).toBe(true);
    }
    const links = db.listRolePermissions();
    for (const migration of PERMISSION_MIGRATIONS) {
      const canonical = db
        .listPermissions()
        .find((entry) => entry.key === migration.newKey);
      expect(
        links.some((entry) => entry.permissionId === canonical!.id),
      ).toBe(true);
    }
  });

  it("reports accurate counts in a mixed scenario", async () => {
    const db = new FakePrisma();
    const obsolete = db.seedPermission({
      key: "maintenance-request:attachments",
      module: "maintenance-request",
      action: "attachments",
    });
    db.seedRolePermission("role-1", obsolete.id);
    db.seedRolePermission("role-2", obsolete.id);
    db.seedPermission({
      key: "installed-parts:read",
      module: "installed-parts",
      action: "read",
    });

    const result = await syncPermissionKeys(
      db as unknown as PrismaClient,
      CANONICAL,
    );

    expect(result.added).toBe(2);
    expect(result.migrated).toBe(1);
    expect(result.migrationDetails[0]).toMatchObject({
      oldKey: "maintenance-request:attachments",
      newKey: "maintenance-request:attachments.view",
      reassignedRoles: 2,
    });
  });

  it("deduplicateExtraPermissions keeps the first occurrence of each key", () => {
    const deduped = deduplicateExtraPermissions([
      { key: "a:read", module: "a", action: "read" },
      { key: "a:read", module: "a-again", action: "read-again" },
      { key: "b:read", module: "b", action: "read" },
    ]);
    expect(deduped).toHaveLength(2);
    expect(deduped[0]).toEqual({ key: "a:read", module: "a", action: "read" });
    expect(deduped[1]?.key).toBe("b:read");
  });
});
