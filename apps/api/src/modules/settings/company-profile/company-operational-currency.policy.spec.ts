import { BadRequestException } from '@nestjs/common'
import {
  COMPANY_OPERATIONAL_CURRENCY_ERROR_KEYS,
  CompanyOperationalCurrencyPolicy,
} from './company-operational-currency.policy'

describe('COST-R1A-C company operational currency policy', () => {
  const policy = new CompanyOperationalCurrencyPolicy()

  it('normalizes a valid ISO-4217 code', () => {
    expect(policy.normalize(' usd ')).toBe('USD')
  })

  it('accepts SAR as an explicitly supplied ISO-4217 code', () => {
    expect(policy.normalize('SAR')).toBe('SAR')
  })

  it('accepts YER as a standard ISO-4217 code', () => {
    expect(policy.normalize('YER')).toBe('YER')
  })

  it('rejects a non-ISO currency code', () => {
    expect(() => policy.normalize('BAD')).toThrow(BadRequestException)
  })

  it('preserves explicit null without inventing a default', () => {
    expect(policy.normalizeNullable(null)).toBeNull()
  })

  it('passes same-currency inventory compatibility', () => {
    expect(policy.assertInventoryLedgerCompatibility('usd', 'USD')).toBe('USD')
  })

  it('blocks cross-currency inventory projection without FX', () => {
    expect(() => policy.assertInventoryLedgerCompatibility('SAR', 'USD')).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          messageKey: COMPANY_OPERATIONAL_CURRENCY_ERROR_KEYS.inventoryMismatch,
        }),
      }),
    )
  })

  it('blocks inventory projection when company currency is not configured', () => {
    expect(() => policy.assertInventoryLedgerCompatibility('USD', null)).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({
          messageKey: COMPANY_OPERATIONAL_CURRENCY_ERROR_KEYS.notConfigured,
        }),
      }),
    )
  })

  it('performs no FX conversion or amount calculation', () => {
    const compatibleCurrency = policy.assertInventoryLedgerCompatibility('USD', 'USD')
    expect(compatibleCurrency).toBe('USD')
    expect(typeof compatibleCurrency).toBe('string')
  })
})
