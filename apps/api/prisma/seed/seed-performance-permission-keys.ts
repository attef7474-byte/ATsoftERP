export const PERFORMANCE_PERMISSIONS: { key: string; module: string; action: string }[] = [
  { key: 'performance-profile:read', module: 'performance-profile', action: 'read' },
  { key: 'performance-profile:create', module: 'performance-profile', action: 'create' },
  { key: 'performance-profile:update', module: 'performance-profile', action: 'update' },
  { key: 'performance-profile:deactivate', module: 'performance-profile', action: 'deactivate' },
  { key: 'performance-profile-mapping:read', module: 'performance-profile-mapping', action: 'read' },
  { key: 'performance-profile-mapping:create', module: 'performance-profile-mapping', action: 'create' },
  { key: 'performance-profile-mapping:update', module: 'performance-profile-mapping', action: 'update' },
  { key: 'performance-profile-mapping:deactivate', module: 'performance-profile-mapping', action: 'deactivate' },
  { key: 'performance-context:read', module: 'performance-context', action: 'read' },
  { key: 'performance-coverage:read', module: 'performance-coverage', action: 'read' },
];
