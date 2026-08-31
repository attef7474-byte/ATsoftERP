import { config } from 'dotenv'
config({ path: '.env' })
import { PrismaClient } from '@prisma/client'
import { PrismaMssql } from '@prisma/adapter-mssql'

const adapter = new PrismaMssql(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

async function main() {
  const COST_PURPOSE_PERMISSIONS: { key: string; module: string; action: string }[] = [
    { key: 'cost-purpose:override', module: 'cost-purpose', action: 'override' },
  ]

  for (const perm of COST_PURPOSE_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { module: perm.module, action: perm.action, status: 'ACTIVE' },
      create: { key: perm.key, module: perm.module, action: perm.action, status: 'ACTIVE' },
    })
  }

  const superAdminRole = await prisma.role.findFirst({ where: { name: 'SUPER_ADMIN' } })
  if (superAdminRole) {
    const allPermissions = await prisma.permission.findMany({ where: { key: { in: COST_PURPOSE_PERMISSIONS.map(p => p.key) } } })
    for (const perm of allPermissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: superAdminRole.id, permissionId: perm.id },
      })
    }
  }

  console.log(`  ✅ ${COST_PURPOSE_PERMISSIONS.length} cost-purpose permissions seeded`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
