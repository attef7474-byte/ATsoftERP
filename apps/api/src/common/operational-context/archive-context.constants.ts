/**
 * Archived organizational context contract.
 *
 * ARCHIVED_ACCESS = ARCHIVE_PERMISSION AND RESOURCE_READ_PERMISSION AND
 *                   ORGANIZATIONAL_OWNERSHIP_VALIDATION.
 *
 * Archive browsing is a strictly read-only mode. It is never a restore, never
 * a reactivation, and never a second authorization system.
 */
export const ARCHIVED_CONTEXT_MODE_HEADER = 'x-active-context-mode';

export const ARCHIVED_CONTEXT_MODE_VALUE = 'archived';

export const ARCHIVE_READ_PERMISSION = 'company:readArchive';

export const ARCHIVE_READABLE_KEY = 'archiveReadable';

/** Fail-closed default: only GET and HEAD are readable in archived mode. */
export const ARCHIVE_READ_ONLY_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'HEAD',
]);

/** Bounded discovery so archive browsing cannot load an unbounded history set. */
export const ARCHIVED_CONTEXT_DISCOVERY_LIMIT = 200;
