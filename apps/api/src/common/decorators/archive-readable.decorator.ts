import { SetMetadata } from '@nestjs/common';
import { ARCHIVE_READABLE_KEY } from '../operational-context/archive-context.constants';

/**
 * Marks a non-GET endpoint as a read-only operation that stays callable while
 * browsing an archived organizational context. Everything else is denied.
 *
 * Deny-by-default: absence of this decorator on a POST/PATCH/PUT/DELETE route
 * always rejects with `archiveContext.readOnly` in archived mode.
 */
export const ArchiveReadable = () => SetMetadata(ARCHIVE_READABLE_KEY, true);
