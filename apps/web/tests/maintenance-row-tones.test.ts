import { maintenanceRequestRowTone, maintenanceWorkOrderRowTone, downtimeRowTone } from '../src/lib/maintenance-row-tones';

describe('maintenance semantic row states', () => {
  it.each([
    ['OPEN', 'attention'], ['IN_PROGRESS', 'in-progress'], ['COMPLETED', 'normal'],
    ['CLOSED', 'normal'], ['CANCELLED', 'normal'], ['UNKNOWN', 'normal'],
  ])('request %s => %s', (status, tone) => expect(maintenanceRequestRowTone({ status })).toBe(tone));

  it.each([
    ['DRAFT', 'attention'], ['PLANNED', 'attention'], ['IN_PROGRESS', 'in-progress'],
    ['COMPLETED', 'normal'], ['CANCELLED', 'normal'], ['UNKNOWN', 'normal'],
  ])('work order %s => %s', (status, tone) => expect(maintenanceWorkOrderRowTone({ status })).toBe(tone));

  const started = '2026-11-22T08:00:00Z';
  it.each([
    [{}, 'attention'], [{ status: 'ACTIVE' }, 'attention'], [{ status: 'OPEN' }, 'attention'],
    [{ startTime: started, responseStartedAt: started }, 'attention'],
    [{ repairStartedAt: started }, 'in-progress'],
    [{ execution: { status: 'PENDING', startedAt: null } }, 'attention'],
    [{ execution: { status: 'IN_PROGRESS', startedAt: started } }, 'in-progress'],
    [{ execution: { status: 'IN_PROGRESS', startedAt: null } }, 'in-progress'],
    [{ execution: { status: 'PENDING', startedAt: started } }, 'in-progress'],
    [{ execution: { status: 'CANCELLED', startedAt: started } }, 'attention'],
    [{ execution: { status: 'DONE', startedAt: started } }, 'normal'],
    [{ execution: { status: 'IN_PROGRESS', completedAt: started } }, 'normal'],
    [{ request: { status: 'OPEN' } }, 'attention'],
    [{ request: { status: 'IN_PROGRESS' } }, 'in-progress'],
    [{ request: { status: 'COMPLETED' } }, 'normal'],
    [{ request: { status: 'CLOSED' } }, 'normal'],
    [{ request: { status: 'CANCELLED' } }, 'attention'],
    [{ execution: { status: 'PENDING' }, request: { status: 'IN_PROGRESS' } }, 'attention'],
    [{ endTime: started, repairStartedAt: started }, 'normal'],
    [{ repairCompletedAt: started, repairStartedAt: started }, 'normal'],
    [{ cancelledAt: started, repairStartedAt: started }, 'normal'],
    ...['CLOSED', 'COMPLETED', 'CANCELLED'].map((status): [any, string] => [{ status, repairStartedAt: started }, 'normal']),
  ])('downtime evidence %j => %s', (record, tone) => expect(downtimeRowTone(record as any)).toBe(tone));

  it('uses canonical values rather than translated status labels', () => {
    expect(maintenanceRequestRowTone({ status: 'قيد التنفيذ' })).toBe('normal');
    expect(downtimeRowTone({ status: 'Active', startTime: started } as any)).toBe('attention');
  });
});
