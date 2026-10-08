import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActiveOperationalContext } from './operational-context.types';

export interface TenantOwnedRow {
  companyId?: string | null;
  branchId?: string | null;
}

export function rowInContext(
  companyId: string | null | undefined,
  branchId: string | null | undefined,
  ctx: ActiveOperationalContext,
): boolean {
  if (companyId !== ctx.companyId) return false;
  if (branchId && branchId !== ctx.branchId) return false;
  return true;
}

export function assertRowInContext(row: TenantOwnedRow, ctx: ActiveOperationalContext, what: string): void {
  if (!rowInContext(row.companyId, row.branchId, ctx)) {
    throw new ForbiddenException(`forbidden: ${what} does not belong to active company`);
  }
}

/**
 * Any object exposing the read methods used by the guards — the root PrismaService
 * or a transaction client inside $transaction. Guards must run on the SAME client
 * that will perform the mutation to avoid TOCTOU.
 */
export type TenantGuardClient = Prisma.TransactionClient | PrismaService;

export function assertWarehouseInContext(
  client: TenantGuardClient,
  warehouseId: string,
  ctx: ActiveOperationalContext,
): Promise<void> {
  return client.warehouse.findUnique({ where: { id: warehouseId } }).then((warehouse) => {
    if (!warehouse) throw new ForbiddenException('forbidden: warehouse does not belong to active company');
    assertRowInContext(warehouse, ctx, 'warehouse');
  });
}

export function assertMachineInContext(
  client: TenantGuardClient,
  machineId: string,
  ctx: ActiveOperationalContext,
): Promise<void> {
  return client.machine.findUnique({ where: { id: machineId } }).then((machine) => {
    if (!machine || machine.companyId !== ctx.companyId) {
      throw new ForbiddenException('forbidden: machine does not belong to active company');
    }
    if (machine.branchId && machine.branchId !== ctx.branchId) {
      throw new ForbiddenException('forbidden: machine does not belong to active branch');
    }
  });
}

export function assertMaintenanceRequestInContext(
  client: TenantGuardClient,
  requestId: string,
  ctx: ActiveOperationalContext,
): Promise<void> {
  return client.maintenanceRequest
    .findUnique({
      where: { id: requestId },
      include: { machine: true },
    })
    .then((request) => {
      if (!request || !request.machine || request.machine.companyId !== ctx.companyId) {
        throw new ForbiddenException('forbidden: maintenance request does not belong to active company');
      }
      if (request.machine.branchId && request.machine.branchId !== ctx.branchId) {
        throw new ForbiddenException('forbidden: maintenance request does not belong to active branch');
      }
    });
}

/**
 * Invariant A — a MachineComponent is physically mounted on exactly one Machine
 * (`MachineComponent.machineId` is required). Any operation that pairs a
 * component with a machine (installed parts, required-part lines) must prove
 * `component.machineId === machineId`; the individual foreign keys only prove
 * each side exists, never that they belong together.
 *
 * Runs on the SAME client that performs the write so the check and the mutation
 * cannot diverge. When `ctx` is supplied the component's owning machine is also
 * proven to belong to the active company/branch (defense in depth against a
 * cross-tenant component whose machine would otherwise never be loaded).
 */
export function assertMachineComponentBelongsToMachine(
  client: TenantGuardClient,
  machineComponentId: string,
  machineId: string,
  ctx?: ActiveOperationalContext,
): Promise<void> {
  return client.machineComponent
    .findUnique({
      where: { id: machineComponentId },
      select: {
        id: true,
        machineId: true,
        machine: { select: { companyId: true, branchId: true } },
      },
    })
    .then((component) => {
      if (!component || (ctx && !rowInContext(component.machine.companyId, component.machine.branchId, ctx))) {
        throw new NotFoundException('Machine component not found or not in the active company/branch');
      }
      if (component.machineId !== machineId) {
        throw new BadRequestException({
          messageKey: 'maintenance.machineComponentMachineMismatch',
          message: 'The machine component does not belong to the selected machine',
        });
      }
    });
}

export function assertInventoryCountInContext(
  client: TenantGuardClient,
  countId: string,
  ctx: ActiveOperationalContext,
): Promise<void> {
  return client.inventoryCount.findUnique({ where: { id: countId } }).then((count) => {
    if (!count) throw new ForbiddenException('forbidden: inventory count does not belong to active company');
    assertRowInContext(count, ctx, 'inventory count');
  });
}
