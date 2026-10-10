import { ValidationPipe } from '@nestjs/common';
import { validateSync } from 'class-validator';
import { getApiMessage } from '../../../../common/i18n/api-messages';
import { CreateMaintenanceTaskDto } from './dto/create-maintenance-task.dto';
import { ExecutionCompleteDto, ExecutionPartInputDto } from './dto/execution-action.dto';

describe('execution input security and storage boundaries', () => {
  it.each(['description', 'notes'])('accepts 1000 characters and rejects overflow for %s', field => {
    expect(validateSync(Object.assign(new CreateMaintenanceTaskDto(), { [field]: 'x'.repeat(1000) }))).toHaveLength(0);
    expect(validateSync(Object.assign(new CreateMaintenanceTaskDto(), { [field]: 'x'.repeat(1001) })).some(error => error.property === field)).toBe(true);
  });
  it('rejects completion notes beyond the actual task storage limit', () => {
    expect(validateSync(Object.assign(new ExecutionCompleteDto(), { notes: 'x'.repeat(1001) }))).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'notes' })]));
  });
  it.each([NaN, Infinity, -1, 0, 0.00001, 1.12345])('rejects unsafe or unrepresentable quantity %s', quantity => {
    const dto = Object.assign(new ExecutionPartInputDto(), { clientRequestId: 'retry', productId: 'p', warehouseId: 'w', usageType: 'CONSUMED', quantity });
    expect(validateSync(dto)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'quantity' })]));
  });
  it('accepts the minimum four-decimal stock quantity', () => {
    expect(validateSync(Object.assign(new ExecutionPartInputDto(), { clientRequestId: 'retry', productId: 'p', warehouseId: 'w', usageType: 'CONSUMED', quantity: 0.0001 }))).toHaveLength(0);
  });
  it.each(['createdById', 'requestedById', 'companyId'])('rejects client-controlled identity %s', async field => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
    await expect(pipe.transform({ sourceType: 'DIRECT', scopeType: 'GENERAL', description: 'work', [field]: 'foreign' }, { type: 'body', metatype: CreateMaintenanceTaskDto })).rejects.toMatchObject({ status: 400 });
  });
  it.each(['maintenance.executionSourceImmutable', 'maintenance.executionActiveSessionConflict', 'maintenance.executionPartIdempotencyConflict'])('localizes domain error %s in both languages', key => {
    for (const locale of ['en', 'ar']) expect(getApiMessage(key, locale)).not.toBe(key);
  });
});
