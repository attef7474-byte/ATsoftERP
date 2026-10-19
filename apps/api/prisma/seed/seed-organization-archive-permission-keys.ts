export const ORGANIZATION_ARCHIVE_PERMISSION_KEYS = [
  'company:readArchive',
] as const;

export const ORGANIZATION_ARCHIVE_PERMISSIONS = ORGANIZATION_ARCHIVE_PERMISSION_KEYS.map(
  (key) => ({
    key,
    module: key.split(':')[0],
    action: key.split(':')[1],
  }),
);
