require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaMssql } = require('@prisma/adapter-mssql');

async function test() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('FAIL: DATABASE_URL not set'); process.exit(1); }
  if (/integratedSecurity/i.test(url)) { console.error('FAIL: still using integratedSecurity'); process.exit(1); }

  console.log('Creating PrismaMssql adapter...');
  const adapter = new PrismaMssql(url);
  console.log('Creating PrismaClient...');
  const prisma = new PrismaClient({ adapter });

  console.log('Connecting...');
  await prisma.$connect();
  console.log('Connected!');

  const companies = await prisma.$queryRaw`SELECT COUNT(*) AS cnt FROM companies`;
  console.log('Companies:', Number(companies[0].cnt));

  const depts = await prisma.$queryRaw`SELECT COUNT(*) AS cnt FROM departments`;
  console.log('Departments:', Number(depts[0].cnt));

  const people = await prisma.$queryRaw`SELECT COUNT(*) AS cnt FROM operational_people`;
  console.log('Operational People:', Number(people[0].cnt));

  const identity = await prisma.$queryRaw`SELECT ORIGINAL_LOGIN() AS login_name, USER_NAME() AS db_user, DB_NAME() AS db_name`;
  console.log('Login:', identity[0].login_name, '| User:', identity[0].db_user, '| DB:', identity[0].db_name);

  await prisma.$disconnect();
  console.log('=== PRISMA CONNECTION PROBE PASS ===');
}

test().catch(e => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
