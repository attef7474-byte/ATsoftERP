const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get admin user
  const user = await prisma.user.findFirst({ where: { email: 'admin@atsofterp.com' } });
  console.log('USER_ID=' + user.id);

  // Get a spare part with productId
  const sparePart = await prisma.sparePart.findFirst({ where: { productId: { not: null } }, include: { product: true } });
  console.log('SPARE_PART_ID=' + sparePart.id);
  console.log('PRODUCT_ID=' + sparePart.productId);

  // Get warehouses
  const sparePartWarehouse = await prisma.warehouse.findFirst({ where: { warehouseType: 'SPARE_PART' } });
  console.log('SPARE_PART_WAREHOUSE_ID=' + sparePartWarehouse.id);

  const productWarehouse = await prisma.warehouse.findFirst({ where: { warehouseType: 'PRODUCT' } });
  console.log('PRODUCT_WAREHOUSE_ID=' + (productWarehouse?.id || 'NONE'));

  const rawMaterialWarehouse = await prisma.warehouse.findFirst({ where: { warehouseType: 'RAW_MATERIAL' } });
  console.log('RAW_MATERIAL_WAREHOUSE_ID=' + (rawMaterialWarehouse?.id || 'NONE'));

  // Get a maintenance request (if any)
  const maintenanceRequest = await prisma.maintenanceRequest.findFirst();
  console.log('MAINTENANCE_REQUEST_ID=' + (maintenanceRequest?.id || 'NONE'));

  // Get a product with stock
  const inventoryBalance = await prisma.inventoryBalance.findFirst({ where: { quantity: { gt: 0 } }, include: { product: true, warehouse: true } });
  console.log('STOCKED_PRODUCT_ID=' + (inventoryBalance?.productId || 'NONE'));
  console.log('STOCKED_WAREHOUSE_ID=' + (inventoryBalance?.warehouseId || 'NONE'));
  console.log('STOCKED_QUANTITY=' + (inventoryBalance?.quantity || 0));

  // Get a company
  const company = await prisma.company.findFirst();
  console.log('COMPANY_ID=' + company.id);

  // Get a machine
  const machine = await prisma.machine.findFirst({ include: { company: true, branch: true } });
  console.log('MACHINE_ID=' + (machine?.id || 'NONE'));
  console.log('MACHINE_COMPANY_ID=' + (machine?.companyId || 'NONE'));
  console.log('MACHINE_BRANCH_ID=' + (machine?.branchId || 'NONE'));

  // Check number sequence
  const seq = await prisma.numberSequence.findUnique({ where: { code: 'SPARE_PART_CONDITION_MOVEMENT' } });
  console.log('SEQUENCE_EXISTS=' + (seq ? 'YES' : 'NO'));
  console.log('SEQUENCE_STATUS=' + (seq?.status || 'N/A'));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
