import { BadRequestException, Injectable } from '@nestjs/common'
import { isISO4217CurrencyCode } from 'class-validator'

export const COMPANY_OPERATIONAL_CURRENCY_ERROR_KEYS = {
  invalid: 'settings.company.invalidOperationalCurrency',
  notConfigured: 'settings.company.operationalCurrencyNotConfigured',
  inventoryMismatch: 'settings.company.inventoryCurrencyMismatch',
  frozen: 'settings.company.operationalCurrencyFrozen',
} as const

@Injectable()
export class CompanyOperationalCurrencyPolicy {
  normalize(currencyCode: string): string {
    const normalized = currencyCode.trim().toUpperCase()
    if (!isISO4217CurrencyCode(normalized)) {
      throw new BadRequestException({
        messageKey: COMPANY_OPERATIONAL_CURRENCY_ERROR_KEYS.invalid,
        message: 'Operational currency must be a valid ISO-4217 currency code',
      })
    }
    return normalized
  }

  normalizeNullable(currencyCode: string | null): string | null {
    return currencyCode === null ? null : this.normalize(currencyCode)
  }

  assertInventoryLedgerCompatibility(
    inventoryCurrencyCode: string,
    operationalCurrencyCode: string | null,
  ): string {
    if (!operationalCurrencyCode) {
      throw new BadRequestException({
        messageKey: COMPANY_OPERATIONAL_CURRENCY_ERROR_KEYS.notConfigured,
        message: 'Company operational currency must be configured before cost-ledger posting',
      })
    }

    const inventoryCurrency = this.normalize(inventoryCurrencyCode)
    const companyCurrency = this.normalize(operationalCurrencyCode)
    if (inventoryCurrency !== companyCurrency) {
      throw new BadRequestException({
        messageKey: COMPANY_OPERATIONAL_CURRENCY_ERROR_KEYS.inventoryMismatch,
        message: 'Inventory event currency must equal the company operational currency; FX is not supported',
      })
    }
    return inventoryCurrency
  }
}
