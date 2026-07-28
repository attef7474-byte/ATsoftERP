import { config } from 'dotenv'
config({ path: '.env' })
import { PrismaClient } from '@prisma/client'
import { PrismaMssql } from '@prisma/adapter-mssql'

const adapter = new PrismaMssql(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

async function main() {
  const GOV_PERMISSIONS: { key: string; module: string; action: string }[] = [
    { key: 'inventory:lock:read', module: 'inventory:lock', action: 'read' },
    { key: 'inventory:lock:create', module: 'inventory:lock', action: 'create' },
    { key: 'inventory:lock:update', module: 'inventory:lock', action: 'update' },
    { key: 'inventory:lock:activate', module: 'inventory:lock', action: 'activate' },
    { key: 'inventory:lock:deactivate', module: 'inventory:lock', action: 'deactivate' },
    { key: 'inventory:lock:delete', module: 'inventory:lock', action: 'delete' },
    { key: 'inventory:lock:override', module: 'inventory:lock', action: 'override' },
    { key: 'inventory:audit:read', module: 'inventory:audit', action: 'read' },
    { key: 'inventory:audit:export', module: 'inventory:audit', action: 'export' },
    { key: 'inventory:governance:read', module: 'inventory:governance', action: 'read' },
    { key: 'inventory:reports:ledger', module: 'inventory:reports', action: 'ledger' },
    { key: 'inventory:reports:reconciliation', module: 'inventory:reports', action: 'reconciliation' },
    { key: 'inventory:reports:permissions-view', module: 'inventory:reports', action: 'permissions-view' },
  ]

  for (const perm of GOV_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { module: perm.module, action: perm.action, status: 'ACTIVE' },
      create: { key: perm.key, module: perm.module, action: perm.action, status: 'ACTIVE' },
    })
  }

  const superAdminRole = await prisma.role.findFirst({ where: { name: 'SUPER_ADMIN' } })
  if (superAdminRole) {
    const allPermissions = await prisma.permission.findMany({ where: { key: { in: GOV_PERMISSIONS.map(p => p.key) } } })
    for (const perm of allPermissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: superAdminRole.id, permissionId: perm.id },
      })
    }
  }

  console.log(`  ✅ ${GOV_PERMISSIONS.length} governance permissions seeded`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
