import {
  ARCHIVE_READ_ONLY_METHODS,
  ARCHIVE_READ_PERMISSION,
  ARCHIVED_CONTEXT_DISCOVERY_LIMIT,
  ARCHIVED_CONTEXT_MODE_HEADER,
  ARCHIVED_CONTEXT_MODE_VALUE,
} from './archive-context.constants';

describe('archive context contract', () => {
  it('defines exactly one archive-read permission key', () => {
    expect(ARCHIVE_READ_PERMISSION).toBe('company:readArchive');
    expect(ARCHIVE_READ_PERMISSION.split(':')).toHaveLength(2);
    expect(ARCHIVE_READ_PERMISSION.split(':')[0]).toBe('company');
    expect(ARCHIVE_READ_PERMISSION.split(':')[1]).toBe('readArchive');
  });

  it('is read-only by default and fail-closed', () => {
    expect([...ARCHIVE_READ_ONLY_METHODS].sort()).toEqual(['GET', 'HEAD']);
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      expect(ARCHIVE_READ_ONLY_METHODS.has(method)).toBe(false);
    }
  });

  it('uses a dedicated mode header that is never the active context itself', () => {
    expect(ARCHIVED_CONTEXT_MODE_HEADER).toBe('x-active-context-mode');
    expect(ARCHIVED_CONTEXT_MODE_VALUE).toBe('archived');
    expect(ARCHIVED_CONTEXT_MODE_HEADER).not.toBe('x-active-company-id');
    expect(ARCHIVED_CONTEXT_MODE_HEADER).not.toBe('x-active-branch-id');
  });

  it('bounds archive discovery', () => {
    expect(ARCHIVED_CONTEXT_DISCOVERY_LIMIT).toBeGreaterThan(0);
    expect(ARCHIVED_CONTEXT_DISCOVERY_LIMIT).toBeLessThanOrEqual(1000);
  });
});
