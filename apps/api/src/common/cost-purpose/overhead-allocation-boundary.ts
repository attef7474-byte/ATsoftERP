import { createHash } from 'crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActiveOperationalContext } from '../operational-context/operational-context.types';

/** Same exact lock identity as B1. Hash partitions locks, never business uniqueness. */
export function overheadAllocationBoundary(ctx: ActiveOperationalContext): string {
  if (!ctx?.companyId || !ctx?.branchId || ctx.companyId.length > 200 || ctx.branchId.length > 200) {
    throw new BadRequestException({ messageKey: 'operationalContext.headersRequired' });
  }
  return 'ATSOFT:OVERHEAD:PERIODS:' + createHash('sha256').update(JSON.stringify([ctx.companyId, ctx.branchId])).digest('hex');
}

export async function acquireOverheadAllocationBoundary(tx: Prisma.TransactionClient, ctx: ActiveOperationalContext) {
  const resource = overheadAllocationBoundary(ctx);
  const result = await tx.$queryRaw<Array<{ result: number }>>`
    DECLARE @result int;
    EXEC @result = sp_getapplock @Resource = ${resource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 5000;
    SELECT @result AS result;
  `;
  if (result[0]?.result !== 0 && result[0]?.result !== 1) {
    throw new ConflictException({ messageKey: 'overhead.concurrencyConflict' });
  }
}
