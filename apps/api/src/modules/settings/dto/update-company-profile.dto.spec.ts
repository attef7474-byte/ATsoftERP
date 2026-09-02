import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { UpdateCompanyProfileDto } from './update-company-profile.dto'

describe('COST-R1A-C UpdateCompanyProfileDto', () => {
  it('normalizes lowercase ISO currency before validation', async () => {
    const dto = plainToInstance(UpdateCompanyProfileDto, { operationalCurrencyCode: ' usd ' })
    expect(dto.operationalCurrencyCode).toBe('USD')
    expect(await validate(dto)).toHaveLength(0)
  })

  it('accepts a standard ISO-4217 code such as YER', async () => {
    const dto = plainToInstance(UpdateCompanyProfileDto, { operationalCurrencyCode: 'YER' })
    expect(await validate(dto)).toHaveLength(0)
  })

  it('rejects an invalid ISO currency', async () => {
    const dto = plainToInstance(UpdateCompanyProfileDto, { operationalCurrencyCode: 'BAD' })
    expect(await validate(dto)).not.toHaveLength(0)
  })

  it('allows explicit null for legacy clearing before freeze', async () => {
    const dto = plainToInstance(UpdateCompanyProfileDto, { operationalCurrencyCode: null })
    expect(await validate(dto)).toHaveLength(0)
  })

  it('allows omission so legacy operations need no currency', async () => {
    const dto = plainToInstance(UpdateCompanyProfileDto, { companyNameEn: 'Legacy Company' })
    expect(await validate(dto)).toHaveLength(0)
    expect(dto.operationalCurrencyCode).toBeUndefined()
  })
})
