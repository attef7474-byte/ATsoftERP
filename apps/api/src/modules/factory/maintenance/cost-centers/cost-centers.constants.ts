export const COST_CENTER_AUDIT_ENTITY = 'CostCenter';
export const OPERATIONAL_COST_CENTER_ASSIGNMENT_AUDIT_ENTITY = 'OperationalCostCenterAssignment';

export const COST_CENTER_PERMISSION_KEYS = {
  create: 'operational-cost-center:create',
  read: 'operational-cost-center:read',
  update: 'operational-cost-center:update',
  delete: 'operational-cost-center:delete',
  activate: 'operational-cost-center:activate',
  deactivate: 'operational-cost-center:deactivate',
  assign: 'operational-cost-center:assign',
} as const;
