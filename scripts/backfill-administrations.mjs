import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Backfill Administrations ===');

  // Find all branches that have departments but no administrations
  const branches = await prisma.branch.findMany({
    where: {
      departments: { some: {} },
    },
    include: {
      _count: { select: { departments: true, administrations: true } },
      company: { select: { name: true } },
    },
  });

  console.log(`Found ${branches.length} branches with departments`);

  let created = 0;
  let updated = 0;

  for (const branch of branches) {
    if (branch._count.administrations > 0) {
      console.log(`  Branch "${branch.name}" already has ${branch._count.administrations} administration(s), skipping`);
      continue;
    }

    // Create default General Administration for this branch
    const admin = await prisma.administration.create({
      data: {
        branchId: branch.id,
        code: `${branch.code}_GEN`,
        name: 'General Administration',
        description: `Default administration for ${branch.name}`,
        status: 'ACTIVE',
      },
    });

    created++;

    // Link all existing departments to the new administration
    const result = await prisma.department.updateMany({
      where: { branchId: branch.id, administrationId: null },
      data: { administrationId: admin.id },
    });

    updated += result.count;
    console.log(`  Created "${admin.name}" for branch "${branch.name}" (${branch.company?.name}), linked ${result.count} departments`);
  }

  // Also handle departments without branchId (link to any admin if possible)
  const orphanDepts = await prisma.department.findMany({
    where: { branchId: null, administrationId: null },
    include: { company: { select: { name: true } } },
  });

  if (orphanDepts.length > 0) {
    console.log(`\nFound ${orphanDepts.length} departments without branchId`);
    for (const dept of orphanDepts) {
      // Find first administration in any branch of this company
      const admin = await prisma.administration.findFirst({
        where: { branch: { companyId: dept.companyId } },
        orderBy: { createdAt: 'asc' },
      });
      if (admin) {
        await prisma.department.update({
          where: { id: dept.id },
          data: { administrationId: admin.id },
        });
        console.log(`  Linked department "${dept.name}" to administration "${admin.name}"`);
        updated++;
      } else {
        // Create default admin in first branch of the company
        const branch = await prisma.branch.findFirst({
          where: { companyId: dept.companyId },
          orderBy: { createdAt: 'asc' },
        });
        if (branch) {
          const admin = await prisma.administration.create({
            data: {
              branchId: branch.id,
              code: `${branch.code}_GEN`,
              name: 'General Administration',
              description: `Default administration for ${dept.company?.name || 'Company'}`,
              status: 'ACTIVE',
            },
          });
          created++;
          await prisma.department.update({
            where: { id: dept.id },
            data: { administrationId: admin.id },
          });
          console.log(`  Created admin and linked department "${dept.name}"`);
          updated++;
        }
      }
    }
  }

  // Verify
  const unlinked = await prisma.department.count({ where: { administrationId: null } });
  const totalAdmins = await prisma.administration.count();
  const totalDepts = await prisma.department.count();

  console.log(`\n=== Summary ===`);
  console.log(`Administrations created: ${created}`);
  console.log(`Departments linked: ${updated}`);
  console.log(`Total administrations: ${totalAdmins}`);
  console.log(`Total departments: ${totalDepts}`);
  console.log(`Unlinked departments: ${unlinked}`);

  if (unlinked > 0) {
    console.log(`WARNING: ${unlinked} departments still lack administrationId`);
    process.exit(1);
  }

  console.log('Backfill complete successfully');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
