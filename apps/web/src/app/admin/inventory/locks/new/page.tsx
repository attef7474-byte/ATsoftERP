'use client'
import React, { useState } from 'react'
import { api } from '../../../../../lib/api'
import { useTranslation } from '../../../../../lib/i18n/use-translation'
import { useToast } from '../../../../../components/admin/toast-provider'
import { Button, Input, Select, Textarea, PageHeader } from '../../../../../components/admin/ui'
import { F9Lookup, warehouseAdapter } from '../../../../../components/f9'
import { useRouter } from 'next/navigation'
import { useApiErrorHandler } from '../../../../../components/admin/error-handler'
import { useErrorModal } from '../../../../../components/admin/error-modal'
import { adaptFieldErrorsToMap, focusFirstInvalidField } from '../../../../../lib/form-validation'

const LOCK_TYPES_KEYS: Record<string, string> = {
  PERIOD_LOCK: 'inventory.periodLock',
  WAREHOUSE_LOCK: 'inventory.warehouseLock',
  LOCATION_LOCK: 'inventory.locationLock',
  ITEM_LOCK: 'inventory.itemLock',
  GLOBAL_INVENTORY_LOCK: 'inventory.globalInventoryLock',
}

const WAREHOUSE_LOCK_TYPES = new Set(['WAREHOUSE_LOCK', 'LOCATION_LOCK', 'ITEM_LOCK'])

export default function NewInventoryLockPage() {
  const router = useRouter()
  const { t, dir } = useTranslation()
  const { showToast } = useToast()
  const handleApiError = useApiErrorHandler()
  const { showError } = useErrorModal()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    code: '',
    lockType: 'PERIOD_LOCK',
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
    warehouseId: '',
    locationId: '',
    productId: '',
    sparePartId: '',
    reason: '',
    notes: '',
  })

  const setField = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
    if (errors[field]) setErrors(prev => { const next = { ...prev }; delete next[field]; return next })
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.code.trim()) errs.code = t('validation.required')
    if (!form.dateFrom) errs.dateFrom = t('validation.required')
    if (!form.dateTo) errs.dateTo = t('validation.required')
    if (form.dateFrom && form.dateTo && form.dateTo < form.dateFrom) {
      errs.dateTo = t('validation.invalidDate')
    }
    if (WAREHOUSE_LOCK_TYPES.has(form.lockType) && !form.warehouseId) {
      errs.warehouseId = t('validation.required')
    }
    if (!form.reason.trim()) errs.reason = t('validation.required')
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const entries = Object.entries(errs).map(([field, message]) => ({ field, message }))
      focusFirstInvalidField(entries)
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await api.post('/inventory/locks', form as any)
      showToast(t('inventory.lockCreatedSuccessfully'), 'success')
      router.push('/admin/inventory/locks')
    } catch (err) {
      const config = handleApiError(err, { dialog: false })
      if (config.errors && config.errors.length > 0) {
        setErrors(adaptFieldErrorsToMap(config.errors))
        focusFirstInvalidField(config.errors)
      } else {
        showError(config)
      }
    } finally {
      setSaving(false)
    }
  }

  const showWarehousePicker = WAREHOUSE_LOCK_TYPES.has(form.lockType)

  return (
    <div dir={dir}>
      <PageHeader title={t('inventory.createLock')} actions={<Button variant="secondary" onClick={() => router.back()}>{t('common.back')}</Button>} />
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4 bg-white p-6 rounded-lg shadow-sm" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="lock-code">{t('common.code')}</label>
            <Input id="lock-code" name="code" value={form.code} onChange={e => setField('code', e.target.value)} required placeholder="LOCK-001" error={errors.code} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="lock-type">{t('inventory.lockType')}</label>
            <Select id="lock-type" name="lockType" value={form.lockType} onChange={e => setField('lockType', e.target.value)} options={Object.entries(LOCK_TYPES_KEYS).map(([value, key]) => ({ value, label: t(key) }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="lock-date-from">{t('inventory.dateFrom')}</label>
            <Input id="lock-date-from" name="dateFrom" type="date" value={form.dateFrom} onChange={e => setField('dateFrom', e.target.value)} required error={errors.dateFrom} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="lock-date-to">{t('inventory.dateTo')}</label>
            <Input id="lock-date-to" name="dateTo" type="date" value={form.dateTo} onChange={e => setField('dateTo', e.target.value)} required error={errors.dateTo} />
          </div>
        </div>
        {showWarehousePicker && (
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="lock-warehouse">{t('inventory.warehouse')}</label>
            <F9Lookup id="lock-warehouse" name="warehouseId" adapter={warehouseAdapter} value={form.warehouseId} onChange={v => setField('warehouseId', v)} error={errors.warehouseId} />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="lock-reason">{t('inventoryCounting.reason')}</label>
          <Textarea id="lock-reason" name="reason" value={form.reason} onChange={e => setField('reason', e.target.value)} required rows={3} placeholder={t('inventory.lockReasonPlaceholder')} error={errors.reason} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="lock-notes">{t('inventoryCounting.notes')}</label>
          <Textarea id="lock-notes" name="notes" value={form.notes} onChange={e => setField('notes', e.target.value)} rows={2} />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={() => router.back()} type="button">{t('common.cancel')}</Button>
          <Button type="submit" loading={saving}>{t('inventory.createLock')}</Button>
        </div>
      </form>
    </div>
  )
}
