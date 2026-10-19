import { config } from 'dotenv'
config({ path: '.env' })
import { PrismaClient } from '@prisma/client'
import { PrismaMssql } from '@prisma/adapter-mssql'
import { ORGANIZATION_ARCHIVE_PERMISSIONS } from './seed-organization-archive-permission-keys'

const adapter = new PrismaMssql(process.env.DATABASE_URL!)
const prisma = new PrismaClient({ adapter })

async function main() {
  for (const perm of ORGANIZATION_ARCHIVE_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { module: perm.module, action: perm.action, status: 'ACTIVE' },
      create: { key: perm.key, module: perm.module, action: perm.action, status: 'ACTIVE' },
    })
  }

  const superAdminRole = await prisma.role.findFirst({ where: { code: 'SUPER_ADMIN' } })
  if (superAdminRole) {
    const permissions = await prisma.permission.findMany({
      where: { key: { in: ORGANIZATION_ARCHIVE_PERMISSIONS.map((p) => p.key) } },
    })
    for (const perm of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: superAdminRole.id, permissionId: perm.id },
      })
    }
  }

  console.log(`  ✅ ${ORGANIZATION_ARCHIVE_PERMISSIONS.length} organization archive permission(s) seeded`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
