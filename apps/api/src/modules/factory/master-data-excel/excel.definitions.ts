import { ExcelColumnDefinition, ExcelDefinition, ExcelEntity, ExcelReference } from '../../../common/excel/excel.types';
import { PRODUCT_ITEM_TYPES } from '../products/product-item-type.domain';

const text = (header: string, field: string, label: string, options: Partial<ExcelColumnDefinition> = {}): ExcelColumnDefinition => ({ header, field, label, type: 'text', maxLength: 255, update: true, importable: true, export: true, example: '', width: 24, ...options });
const ref = (header: string, field: string, label: string, reference: ExcelReference, options: Partial<ExcelColumnDefinition> = {}) => text(header, field, label, { reference, maxLength: 100, ...options });
const number = (header: string, field: string, label: string) => text(header, field, label, { type: 'number', example: '0', width: 20 });
const identity = () => text('Code', 'code', 'common.code', { required: 'identity', update: false, maxLength: 100, example: 'ITEM-0001', width: 22 });
const name = () => text('Name', 'name', 'common.name', { required: 'create', maxLength: 255, example: 'اسم / Name', width: 32 });
const description = () => text('Description', 'description', 'common.description', { maxLength: 4000, width: 45 });
const technical = () => [text('Manufacturer', 'manufacturer', 'maintenance.manufacturer'), text('Model', 'model', 'common.model')];
const units = () => [ref('UnitCode', 'unitId', 'inventoryCounting.unit', 'unit', { update: false }), text('UnitLabel', 'unit', 'inventoryCounting.unit', { importable: false, update: false })];
const CC_TYPES = ['PRODUCTION', 'MAINTENANCE', 'PROJECT', 'DEVELOPMENT', 'QUALITY', 'UTILITIES', 'ADMIN', 'OTHER'];
const COMPONENT_TYPES = ['MECHANICAL', 'ELECTRICAL', 'CONTROL', 'PNEUMATIC', 'HYDRAULIC', 'HEATING', 'COOLING', 'SENSOR', 'SAFETY', 'CONVEYOR', 'FRAME', 'UTILITY', 'OTHER'];

export const EXCEL_DEFINITIONS: Record<ExcelEntity, ExcelDefinition> = {
  machines: { entity: 'machines', model: 'machine', permission: 'machine', shared: false, keyHeaders: ['Code'], columns: [
    identity(), name(), ref('CategoryCode', 'categoryId', 'maintenance.category', 'machineCategory'), ref('DepartmentCode', 'departmentId', 'core.department', 'department'),
    ref('ProductionLineCode', 'productionLineId', 'maintenance.productionLine', 'productionLine'), ref('OperationTypeCode', 'operationTypeId', 'maintenance.operationType', 'operationType'),
    ...technical(), text('SerialNumber', 'serialNumber', 'maintenance.serialNumber'),
    text('PurchaseDate', 'purchaseDate', 'maintenance.purchaseDate', { type: 'date', example: '2026-11-17', width: 18 }),
    text('WarrantyEnd', 'warrantyEnd', 'maintenance.warrantyEnd', { type: 'date', example: '2027-11-17', width: 18 }),
    text('Location', 'location', 'common.location'), text('Notes', 'notes', 'common.notes', { maxLength: 4000, width: 45 }),
    text('CostCenterName', 'costCenterName', 'maintenance.costCenter', { update: false, example: 'اسم الآلة / Machine name' }),
    text('CostCenterType', 'costCenterType', 'common.type', { type: 'enum', values: CC_TYPES, required: 'create', update: false, example: 'PRODUCTION' }),
  ] },
  // ONE logical component per row. `Code` is the immutable identity; machines
  // are a delimited multi-value attribute resolved to machineIds/machineData in
  // the planner. Legacy single-machine headers stay importable for old files.
  'machine-components': { entity: 'machine-components', model: 'machineComponent', permission: 'machine-component', shared: false, keyHeaders: ['Code'], columns: [
    identity(),
    text('MachineCodes', 'machineCodes', 'maintenance.machine', { maxLength: 1000, example: 'M01;M02;M03', width: 34 }),
    name(),
    text('LocationsInMachine', 'locationsInMachine', 'common.location', { maxLength: 1000, example: 'Upper;Lower;Frame', width: 34 }),
    text('SerialNumbers', 'serialNumbers', 'maintenance.serialNumber', { maxLength: 1000, example: 'S-01;S-02;S-03', width: 34 }),
    text('MachineCode', 'machineCode', 'maintenance.machine', { importable: true, export: false, update: false, example: 'M01', width: 24 }),
    text('LocationInMachine', 'legacyLocationInMachine', 'common.location', { importable: true, export: false, update: false, width: 24 }),
    text('SerialNumber', 'legacySerialNumber', 'maintenance.serialNumber', { importable: true, export: false, update: false, width: 24 }),
    ref('ParentComponentCode', 'parentComponentId', 'maintenance.parentComponent', 'parentComponent'),
    text('ComponentType', 'componentType', 'maintenance.componentType', { type: 'enum', values: COMPONENT_TYPES, required: 'create', example: 'MECHANICAL' }),
    text('Criticality', 'criticality', 'maintenance.criticality', { type: 'enum', values: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], example: 'MEDIUM' }),
    description(), ...technical(),
  ] },
  'spare-parts': { entity: 'spare-parts', model: 'sparePart', permission: 'spare-part', shared: true, keyHeaders: ['Code'], columns: [
    identity(), name(), description(), text('Category', 'category', 'maintenance.category'), text('Specification', 'specification', 'maintenance.specification'),
    ...units(), ...technical(), text('PartNumber', 'partNumber', 'maintenance.partNumber'), text('Barcode', 'barcode', 'common.barcode', { maxLength: 255, example: '0000123456789' }),
    ref('ProductCode', 'productId', 'reports.product', 'product'), number('MinRecommendedStock', 'minRecommendedStock', 'inventoryCounting.minStock'), number('MaxRecommendedStock', 'maxRecommendedStock', 'inventoryCounting.maxStock'),
    number('ReorderPoint', 'reorderPoint', 'maintenance.reorderPoint'), text('IsCritical', 'isCritical', 'maintenance.isCritical', { type: 'boolean', example: 'false' }),
    text('TechnicalClassification', 'technicalClassification', 'maintenance.technicalClassification'), text('UsageType', 'usageType', 'maintenance.usageType'), text('Nature', 'nature', 'maintenance.nature'), text('Importance', 'importance', 'maintenance.importance'),
  ] },
  products: { entity: 'products', model: 'product', permission: 'products', shared: true, keyHeaders: ['Code'], columns: [
    identity(), name(),
    text('ItemType', 'itemType', 'inventory.itemType', {
      type: 'enum', values: [...PRODUCT_ITEM_TYPES], required: 'create', example: 'RAW_MATERIAL', width: 26,
    }),
    description(), ref('CategoryCode', 'categoryId', 'inventory.category', 'productCategory'),
    ref('UnitCode', 'unitId', 'inventoryCounting.unit', 'unit', { required: 'create', update: false }), text('UnitLabel', 'unit', 'inventoryCounting.unit', { importable: false, update: false }),
    text('Barcode', 'barcode', 'common.barcode', { maxLength: 255, example: '0000123456789' }), number('MinStock', 'minStock', 'inventoryCounting.minStock'), number('MaxStock', 'maxStock', 'inventoryCounting.maxStock'),
  ] },
};
