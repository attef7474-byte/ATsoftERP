export const CAPACITY_STATUSES = ['DRAFT', 'APPROVED', 'SUSPENDED', 'ARCHIVED'] as const;
export const CAPACITY_OUTPUT_UNITS = ['PACK', 'UNIT', 'KG', 'TON', 'LITER', 'BATCH'] as const;
export const CAPACITY_TIME_BASES = ['MINUTE', 'HOUR'] as const;
export const CAPACITY_SOURCE_TYPES = ['MEASURED', 'ENGINEERING', 'SUPPLIER', 'HISTORICAL', 'OWNER_OVERRIDE'] as const;

export type CapacityStatus = typeof CAPACITY_STATUSES[number];
export type CapacityOutputUnit = typeof CAPACITY_OUTPUT_UNITS[number];
export type CapacityTimeBasis = typeof CAPACITY_TIME_BASES[number];
export type CapacitySourceType = typeof CAPACITY_SOURCE_TYPES[number];

export const CAPACITY_AUDIT_ENTITY = 'ProductionCapacityStandard';
export const CAPACITY_NUMBER_SEQUENCE = 'PRODUCTION_CAPACITY_STANDARD';
