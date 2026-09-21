import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ALLOCATION_PRECISION_ERROR, calculateOverheadAllocation as calculate } from './overhead-allocation.engine';

const sources = (amount: string, costPurpose = 'PRODUCTION') => [{ id: 'source', amount, costPurpose, currencyCode: 'USD' }];
const targets = (...weights: string[]) => weights.map((driverQuantity, i) => ({ id: 'run-' + String(i + 1).padStart(3, '0'), driverQuantity }));
function precisionFailure(amount: string, weights: string[]) {
  try { calculate(sources(amount), targets(...weights), 'USD'); throw new Error('Expected rejection'); }
  catch (error) { expect(error).toBeInstanceOf(BadRequestException); expect((error as BadRequestException).getResponse()).toEqual({ messageKey: ALLOCATION_PRECISION_ERROR }); }
}
function conserved(amount: string, weights: string[]) {
  const result = calculate(sources(amount), targets(...weights), 'USD');
  expect(result.lines).toHaveLength(weights.length);
  expect(result.lines.every(l => new Prisma.Decimal(l.allocatedAmount).gt(0))).toBe(true);
  expect(result.lines.reduce((sum, l) => sum.plus(l.allocatedAmount), new Prisma.Decimal(0)).toFixed(4)).toBe(new Prisma.Decimal(amount).toFixed(4));
  return result;
}
describe('B2 frozen Decimal algorithm and owner representability decision', () => {
  it('case 1: rejects 0.0003 / five equal drivers', () => precisionFailure('0.0003', Array(5).fill('1')));
  it('case 2: rejects 0.0001 / three equal drivers', () => precisionFailure('0.0001', Array(3).fill('1')));
  it('case 3: accepts five minimum quanta exactly', () => {
    expect(conserved('0.0005', Array(5).fill('1')).lines.map(l => l.allocatedAmount)).toEqual(Array(5).fill('0.0001'));
  });
  it('case 4: a single target gets the exact source', () => expect(conserved('0.0001', ['7']).lines[0].allocatedAmount).toBe('0.0001'));
  it('case 5: ordinary equal weights and stable-ID remainder', () => expect(conserved('100.0000', ['1','1','1']).lines.map(l => l.allocatedAmount)).toEqual(['33.3334','33.3333','33.3333']));
  it('case 6: unequal representable weights', () => expect(conserved('100.0000', ['1','2','3']).lines.map(l => l.allocatedAmount)).toEqual(['16.6667','33.3333','50.0000']));
  it('case 7: necessary precheck passes but tiny driver rounds to zero', () => precisionFailure('100.0000', ['1','10000000']));
  it('case 8: precheck passes but whole remainder makes the recipient negative', () => precisionFailure('0.0011', Array(7).fill('1')));
  it('rejects a zero remainder-recipient even though the precheck passes', () => precisionFailure('0.0008', Array(5).fill('1')));
  it('case 9: repeating ratios remain exact', () => { conserved('123456.7891', ['1','7','13']); });
  it('rounds HALF_UP then assigns the WHOLE negative remainder to the stable target', () => expect(conserved('1.0001', ['1','1']).lines.map(l => l.allocatedAmount)).toEqual(['0.5000','0.5001']));
  it('cases 10/11: repeated and rotated/reversed inputs are logically identical', () => {
    const rows = targets('3','3','2','1'), source = sources('101.0001');
    const expected = calculate(source, rows, 'USD');
    for (let i=0; i<30; i++) {
      const offset = i % rows.length, rotated = rows.slice(offset).concat(rows.slice(0, offset));
      expect(calculate(source, rotated, 'USD')).toEqual(expected);
      expect(calculate(source, [...rotated].reverse(), 'USD')).toEqual(expected);
    }
  });
  it('keeps each purpose pool independent and aggregates multiple exact sources once', () => {
    const input = [...sources('99.9999'), { ...sources('0.0001')[0], id: 'second' }, { ...sources('11.0000','ADMIN')[0], id: 'admin' }];
    const result = calculate(input.reverse(), targets('2','1'), 'USD');
    expect(result.sourceAmount).toBe('111.0000');
    expect(result.purposeCount).toBe(2);
    for (const purpose of ['PRODUCTION','ADMIN']) {
      const lines = result.lines.filter(l => l.costPurpose === purpose);
      expect(lines.reduce((sum,l) => sum.plus(l.allocatedAmount), new Prisma.Decimal(0)).toFixed(4)).toBe(purpose === 'PRODUCTION' ? '100.0000' : '11.0000');
    }
  });
  it('supports the largest valid monetary amount without binary rounding', () => { conserved('999999999999999.9999', ['99999999999999.9999']); });
  it('rejects a derived line exceeding DECIMAL(19,4), never truncates it', () => {
    expect(() => calculate([...sources('999999999999999.9999'), { ...sources('1')[0], id: 'second' }], targets('1'), 'USD')).toThrow(BadRequestException);
  });
  it.each(['0','-1','1.00001','NaN','Infinity','1e2','100000000000000'])('rejects invalid driver %s', value => expect(() => calculate(sources('100'), targets(value), 'USD')).toThrow(BadRequestException));
  it.each(['0','-1','1.00001','1e2','1000000000000000'])('rejects invalid source %s', value => expect(() => calculate(sources(value), targets('1'), 'USD')).toThrow(BadRequestException));
  it('rejects empty source or target sets', () => {
    expect(() => calculate([], targets('1'), 'USD')).toThrow(BadRequestException);
    expect(() => calculate(sources('1'), [], 'USD')).toThrow(BadRequestException);
  });
  it('rejects duplicate source identities and targets', () => {
    expect(() => calculate([...sources('1'), ...sources('1')], targets('1'), 'USD')).toThrow(BadRequestException);
    expect(() => calculate(sources('1'), [...targets('1'), ...targets('2')], 'USD')).toThrow(BadRequestException);
  });
  it('rejects unknown purpose and currency mismatch', () => {
    expect(() => calculate(sources('1', 'OVERHEAD'), targets('1'), 'USD')).toThrow(BadRequestException);
    expect(() => calculate(sources('1'), targets('1'), 'YER')).toThrow(BadRequestException);
  });
  it('does not change the shared Decimal configuration', () => {
    const before = { precision: Prisma.Decimal.precision, rounding: Prisma.Decimal.rounding };
    conserved('100', ['1','2']);
    expect({ precision: Prisma.Decimal.precision, rounding: Prisma.Decimal.rounding }).toEqual(before);
  });
});
