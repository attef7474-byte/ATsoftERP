import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';

export const PREVENTIVE_SCHEDULE_DUPLICATE_MESSAGE_KEY = 'maintenance.preventiveScheduleDuplicateActive';

export interface PreventiveScheduleIdentity {
  machineId: string;
  type: string;
  frequency: string;
  intervalDays?: number | null;
}

type PrismaLike = {
  $queryRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>;
  maintenanceSchedule: {
    findFirst: (args: any) => Promise<{ id: string; title: string } | null>;
  };
};

/**
 * Centralized server-side guard preventing more than one ACTIVE equivalent
 * preventive maintenance schedule per canonical semantic fingerprint.
 *
 * Fingerprint = machineId | type | frequency | intervalDays (null-safe).
 * Tenancy is implied by machineId (a machine belongs to exactly one
 * company/branch) and callers validate the machine against the active context
 * before invoking the guard, so no foreign-tenant row can collide.
 */
@Injectable()
export class PreventiveScheduleDuplicateGuard {
  constructor(private prisma: PrismaService) {}

  fingerprint(identity: PreventiveScheduleIdentity): string {
    const interval = identity.intervalDays ?? null;
    return [identity.machineId, identity.type, identity.frequency, interval === null ? 'NULL' : String(interval)].join('|');
  }

  /**
   * Take a transaction-scoped SQL Server application lock keyed by the
   * fingerprint so two concurrent equivalent create/update/activate requests
   * cannot both pass the existence check. Released automatically on
   * transaction commit/rollback.
   */
  async acquireLock(client: PrismaLike, identity: PreventiveScheduleIdentity): Promise<void> {
    const resource = `preventive-schedule:${this.fingerprint(identity)}`.slice(0, 255).replace(/'/g, "''");
    const rows = (await client.$queryRawUnsafe(
      `DECLARE @res int; EXEC @res = sp_getapplock @Resource = N'${resource}', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 8000; SELECT @res AS result;`,
    )) as Array<{ result: number }>;
    const result = Number(rows?.[0]?.result ?? -999);
    if (result < 0) {
      // Contention on the same fingerprint implies a concurrent equivalent
      // write is in flight; treat as the same deterministic conflict.
      throw new ConflictException({
        messageKey: PREVENTIVE_SCHEDULE_DUPLICATE_MESSAGE_KEY,
        message: 'An equivalent active preventive maintenance schedule already exists.',
        params: {},
      });
    }
  }

  async findEquivalentActive(client: PrismaLike, identity: PreventiveScheduleIdentity, excludeId?: string) {
    return client.maintenanceSchedule.findFirst({
      where: {
        machineId: identity.machineId,
        type: identity.type,
        frequency: identity.frequency,
        intervalDays: identity.intervalDays ?? null,
        status: 'ACTIVE',
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, title: true },
    });
  }

  async assertNoEquivalentActive(client: PrismaLike, identity: PreventiveScheduleIdentity, excludeId?: string) {
    const existing = await this.findEquivalentActive(client, identity, excludeId);
    if (existing) {
      throw new ConflictException({
        messageKey: PREVENTIVE_SCHEDULE_DUPLICATE_MESSAGE_KEY,
        message: 'An equivalent active preventive maintenance schedule already exists.',
        params: { existingScheduleId: existing.id, existingScheduleTitle: existing.title },
      });
    }
    return existing;
  }
}
