export const BATCH_A_PERMISSIONS: { key: string; module: string; action: string }[] = [
  // job-title
  { key: 'job-title:create', module: 'job-title', action: 'create' },
  { key: 'job-title:read', module: 'job-title', action: 'read' },
  { key: 'job-title:update', module: 'job-title', action: 'update' },
  { key: 'job-title:delete', module: 'job-title', action: 'delete' },
  // person-assignment
  { key: 'person-assignment:create', module: 'person-assignment', action: 'create' },
  { key: 'person-assignment:read', module: 'person-assignment', action: 'read' },
  { key: 'person-assignment:update', module: 'person-assignment', action: 'update' },
  { key: 'person-assignment:transfer', module: 'person-assignment', action: 'transfer' },
  // supervisor
  { key: 'supervisor:read', module: 'supervisor', action: 'read' },
  { key: 'supervisor:assign', module: 'supervisor', action: 'assign' },
  { key: 'supervisor:remove', module: 'supervisor', action: 'remove' },
  // department classification (extends existing department module)
  { key: 'department:classify', module: 'department', action: 'classify' },
];
