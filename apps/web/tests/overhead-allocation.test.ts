import { allocationAmountText, canFinalizeAllocation } from '../src/lib/overhead-allocation';
describe('B2 exact display and final-action state', () => {
  it.each([['999999999999999.9999','999999999999999.9999'],['0.0001','0.0001'],['100','100.0000'],['33.3','33.3000']])('preserves amount %s', (input,expected) => expect(allocationAmountText(input)).toBe(expected));
  it('allows reviewed authorized DRAFT finalization only', () => expect(canFinalizeAllocation('DRAFT',true,true,false)).toBe(true));
  it.each([['FINAL',true,true,false],['DRAFT',false,true,false],['DRAFT',true,false,false],['DRAFT',true,true,true]] as const)('denies invalid action state %s', (status,preview,allowed,busy) => expect(canFinalizeAllocation(status,preview,allowed,busy)).toBe(false));
});
