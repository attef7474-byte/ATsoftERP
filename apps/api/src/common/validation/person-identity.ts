import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Transform } from 'class-transformer';
import { registerDecorator } from 'class-validator';
import { ActiveOperationalContext } from '../operational-context/operational-context.types';

export const normalizePersonName = (value: string) => value.trim().replace(/\s+/gu, ' ');
export const isFullPersonName = (value: unknown): value is string =>
  typeof value === 'string' && normalizePersonName(value).split(' ').filter(Boolean).length >= 4;

/** Yemen only. No carrier restrictions, punctuation stripping or Arabic letter folding. */
export function normalizeYemenPhone(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^(?:\+967|00967)?[0-9]{9}$/.test(value)) {
    throw identityError('phone', 'validation.yemenPhone');
  }
  return `+967${value.slice(-9)}`;
}

export function identityError(field: string, code: string, duplicate = false) {
  const payload = { messageKey: code, errors: [{ field, code }] };
  return duplicate ? new ConflictException(payload) : new BadRequestException(payload);
}

export function normalizeIdentity<T extends { name?: unknown; phone?: unknown }>(dto: T): T {
  const result = { ...dto };
  if (dto.name !== undefined) {
    if (!isFullPersonName(dto.name)) throw identityError('name', 'validation.personFullName');
    result.name = normalizePersonName(dto.name);
  }
  if (dto.phone !== undefined) result.phone = normalizeYemenPhone(dto.phone);
  return result;
}

export function FullPersonName(): PropertyDecorator {
  return (target, propertyKey) => {
    Transform(({ value }) => typeof value === 'string' ? normalizePersonName(value) : value)(target, propertyKey);
    registerDecorator({ name: 'fullPersonName', target: target.constructor, propertyName: String(propertyKey),
      options: { message: 'validation.personFullName' }, validator: { validate: isFullPersonName } });
  };
}

export function YemenPhone(): PropertyDecorator {
  return (target, propertyKey) => registerDecorator({ name: 'yemenPhone', target: target.constructor,
    propertyName: String(propertyKey), options: { message: 'validation.yemenPhone' },
    validator: { validate(value: unknown) { try { normalizeYemenPhone(value); return true; } catch { return false; } } } });
}

/**
 * Serialize identity writes on the owning company row. Legacy data contains collisions,
 * so an unconditional unique index/backfill would be unsafe. All participating writers
 * hold this SQL Server update lock until commit; no production identity is rewritten.
 */
export async function lockIdentityCompany(tx: Prisma.TransactionClient, ctx: ActiveOperationalContext) {
  if (!ctx?.companyId || !ctx.branchId) throw new ForbiddenException({ messageKey: 'maintenance.executionContextRequired' });
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM companies WITH (UPDLOCK, HOLDLOCK) WHERE id = ${ctx.companyId} AND deletedAt IS NULL
  `);
  if (!rows.length) throw new ForbiddenException({ messageKey: 'maintenance.executionContextRequired' });
}

/** Company-wide within each authority; User and OperationalPerson are never compared. */
export async function assertIdentityAvailable(
  tx: Prisma.TransactionClient, authority: 'user' | 'operationalPerson',
  dto: { name?: unknown; phone?: unknown }, ctx: ActiveOperationalContext, excludeId?: string,
) {
  if (dto.name === undefined && !dto.phone) return;
  const name = typeof dto.name === 'string' ? normalizePersonName(dto.name) : undefined;
  const phone = dto.phone ? normalizeYemenPhone(dto.phone) : null;
  const scope = authority === 'user' ? { companyId: ctx.companyId, deletedAt: null } : {
    assignments: { some: { companyId: ctx.companyId, deletedAt: null } },
  };
  // Bounded pages preserve comparison with noncanonical legacy whitespace/phone forms.
  let cursor: string | undefined;
  for (;;) {
    const rows: Array<{ id: string; name: string; phone: string | null }> = await (tx[authority] as any).findMany({
      where: { ...scope, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true, name: true, phone: true }, orderBy: { id: 'asc' }, take: 250,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const row of rows) {
      if (name && normalizePersonName(row.name) === name) throw identityError('name', 'validation.personNameDuplicate', true);
      if (phone && row.phone) {
        let existing: string | null = null;
        try { existing = normalizeYemenPhone(row.phone); } catch { /* Invalid legacy values remain unchanged. */ }
        if (existing === phone) throw identityError('phone', 'validation.personPhoneDuplicate', true);
      }
    }
    if (rows.length < 250) return;
    cursor = rows[rows.length - 1].id;
  }
}
