import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ActiveOperationalContext } from '../../common/operational-context/operational-context.types';
import { CreateNumberSequenceDto } from './dto/create-number-sequence.dto';
import { UpdateNumberSequenceDto } from './dto/update-number-sequence.dto';

type AuditActor = { id?: string; sub?: string; employeeId?: string | null };

@Injectable()
export class NumberingService {
  constructor(
    private prisma: PrismaService,
    // Optional injection: modules are owned by another integration step.
    @Optional() private auditService?: AuditService,
  ) {}

  private get audit(): AuditService | undefined {
    // Guard test doubles that omit auditLog; real PrismaService always exposes it.
    if (!this.auditService && (this.prisma as any).auditLog?.create) this.auditService = new AuditService(this.prisma);
    return this.auditService;
  }

  private auditIdentity(actor?: AuditActor, ctx?: ActiveOperationalContext) {
    const candidate = actor ?? (ctx as any)?.actor ?? (ctx as any)?.user;
    return {
      userId: actor?.id ?? actor?.sub ?? (ctx as any)?.userId ?? (ctx as any)?.actorUserId,
      employeeId: candidate?.employeeId ?? null,
    };
  }

  private auditScope(ctx?: ActiveOperationalContext) {
    return {
      companyId: ctx?.companyId ?? null,
      branchId: ctx?.branchId ?? null,
      scope: ctx ? ctx.source : 'GLOBAL',
    };
  }

  async create(dto: CreateNumberSequenceDto, actor?: AuditActor, ctx?: ActiveOperationalContext) {
    const created = await this.prisma.numberSequence.create({ data: dto });
    const identity = this.auditIdentity(actor, ctx);
    await this.audit?.log(identity.userId, 'CREATE', 'NumberSequence', created.id, {
      ...this.auditScope(ctx),
      ...identity,
      next: { code: created.code, status: created.status, prefix: created.prefix, currentNumber: created.currentNumber },
    });
    return created;
  }

  async findAll(query: { page?: number; limit?: number; search?: string; status?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { code: { contains: query.search } },
        { name: { contains: query.search } },
      ];
    }
    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.numberSequence.findMany({ where, skip, take: limit, orderBy: { code: 'asc' } }),
      this.prisma.numberSequence.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const seq = await this.prisma.numberSequence.findUnique({ where: { id } });
    if (!seq) throw new NotFoundException({ messageKey: 'numbering.sequenceNotFound', message: 'Number sequence not found' });
    return seq;
  }

  async findByCode(code: string) {
    const seq = await this.prisma.numberSequence.findUnique({ where: { code } });
    if (!seq) throw new NotFoundException({ messageKey: 'numbering.sequenceNotFound', message: 'Number sequence not found' });
    return seq;
  }

  async update(id: string, dto: UpdateNumberSequenceDto, actor?: AuditActor, ctx?: ActiveOperationalContext) {
    const before = await this.findOne(id);
    const updated = await this.prisma.numberSequence.update({ where: { id }, data: dto });
    const identity = this.auditIdentity(actor, ctx);
    await this.audit?.log(identity.userId, 'UPDATE', 'NumberSequence', id, {
      ...this.auditScope(ctx),
      ...identity,
      previous: { code: before.code, status: before.status, prefix: before.prefix, currentNumber: before.currentNumber },
      next: { code: updated.code, status: updated.status, prefix: updated.prefix, currentNumber: updated.currentNumber },
      changedFields: Object.keys(dto),
    });
    return updated;
  }

  async preview(id: string) {
    const seq = await this.findOne(id);
    const nextNumber = await this.computeNextNumber(seq);
    const generated = this.formatNumber(seq, nextNumber);
    return { number: generated, sequence: seq.code, currentNumber: seq.currentNumber, nextNumber };
  }

  async generateNumber(code: string, actor?: AuditActor, ctx?: ActiveOperationalContext) {
    return this.prisma.$transaction(async (tx) => {
      const seq = await tx.numberSequence.findUnique({ where: { code } });
      if (!seq) throw new NotFoundException({ messageKey: 'numbering.sequenceNotFound', message: 'Number sequence not found' });
      if (seq.status !== 'ACTIVE') throw new BadRequestException({ messageKey: 'numbering.sequenceInactive', message: 'Number sequence is inactive' });

      const nextNumber = await this.computeNextNumber(seq);
      const generated = this.formatNumber(seq, nextNumber);

      await tx.numberSequence.update({
        where: { id: seq.id },
        data: {
          currentNumber: nextNumber,
          lastGeneratedCode: generated,
          lastResetAt: this.shouldReset(seq) ? new Date() : undefined
        },
      });

      const identity = this.auditIdentity(actor, ctx);
      await this.audit?.logWithClient(tx, {
        userId: identity.userId,
        action: 'NUMBER_GENERATED',
        entity: 'NumberSequence',
        entityId: seq.id,
        details: {
          ...this.auditScope(ctx),
          ...identity,
          previous: { currentNumber: seq.currentNumber, lastGeneratedCode: seq.lastGeneratedCode },
          next: { currentNumber: nextNumber, lastGeneratedCode: generated },
        },
      });

      return { number: generated, sequence: seq.code, currentNumber: nextNumber };
    });
  }

  async generateNumberAtomic(code: string, actor?: AuditActor, ctx?: ActiveOperationalContext): Promise<string> {
    return this.prisma.$transaction((tx) => this.generateNumberAtomicWithClient(code, tx, actor, ctx));
  }

  async generateNumberAtomicWithClient(code: string, client: any, actor?: AuditActor, ctx?: ActiveOperationalContext): Promise<string> {
    const seq = await client.numberSequence.findUnique({ where: { code } });
    if (!seq) throw new NotFoundException({ messageKey: 'numbering.sequenceNotFound' });
    if (seq.status !== 'ACTIVE') throw new BadRequestException({ messageKey: 'numbering.sequenceInactive' });

    if (seq.resetPolicy === 'NEVER') {
      const updated = await client.numberSequence.update({
        where: { id: seq.id },
        data: { currentNumber: { increment: seq.increment || 1 } },
      });
      const generated = this.formatNumber(updated, updated.currentNumber);
      await client.numberSequence.update({ where: { id: seq.id }, data: { lastGeneratedCode: generated } });
      await this.auditGeneration(client, seq, generated, updated.currentNumber, actor, ctx);
      return generated;
    }

    const nextNumber = await this.computeNextNumber(seq);
    const generated = this.formatNumber(seq, nextNumber);
    await client.numberSequence.update({
      where: { id: seq.id },
      data: {
        currentNumber: nextNumber,
        lastGeneratedCode: generated,
        lastResetAt: this.shouldReset(seq) ? new Date() : undefined,
      },
    });
    await this.auditGeneration(client, seq, generated, nextNumber, actor, ctx);
    return generated;
  }

  /**
   * Internal numbering is a side effect of another entity's write; it is only
   * audited when a caller supplies actor/scope metadata, so nested document
   * writes do not produce actorless audit rows that tenant readers cannot see.
   */
  private async auditGeneration(client: any, seq: any, generated: string, nextNumber: number, actor?: AuditActor, ctx?: ActiveOperationalContext) {
    if (!actor && !ctx) return;
    const identity = this.auditIdentity(actor, ctx);
    await this.audit?.logWithClient(client, {
      userId: identity.userId,
      action: 'NUMBER_GENERATED',
      entity: 'NumberSequence',
      entityId: seq.id,
      details: {
        ...this.auditScope(ctx),
        ...identity,
        previous: { currentNumber: seq.currentNumber, lastGeneratedCode: seq.lastGeneratedCode },
        next: { currentNumber: nextNumber, lastGeneratedCode: generated },
      },
    });
  }

  private formatNumber(seq: { prefix: string; suffix: string | null; padding: number }, nextNumber: number): string {
    const padded = String(nextNumber).padStart(seq.padding, '0');
    return `${seq.prefix}${padded}${seq.suffix || ''}`;
  }

  private async computeNextNumber(seq: { id: string; resetPolicy: string; currentNumber: number; lastResetAt: Date | null; increment: number }): Promise<number> {
    if (this.shouldReset(seq)) {
      return 1;
    }
    return seq.currentNumber + (seq.increment || 1);
  }

  private shouldReset(seq: { id: string; resetPolicy: string; currentNumber: number; lastResetAt: Date | null }): boolean {
    if (!seq.lastResetAt || seq.resetPolicy === 'NEVER') return false;
    const now = new Date();
    const last = new Date(seq.lastResetAt);
    switch (seq.resetPolicy) {
      case 'YEARLY':
        return now.getFullYear() !== last.getFullYear();
      case 'MONTHLY':
        return now.getFullYear() !== last.getFullYear() || now.getMonth() !== last.getMonth();
      case 'DAILY':
        return now.getFullYear() !== last.getFullYear() ||
          now.getMonth() !== last.getMonth() ||
          now.getDate() !== last.getDate();
      default:
        return false;
    }
  }
}
