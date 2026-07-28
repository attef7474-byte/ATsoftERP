'use client'
import React, { useState } from 'react'
import { api } from '../../../../../lib/api'
import { useTranslation } from '../../../../../lib/i18n/use-translation'
import { useToast } from '../../../../../components/admin/toast-provider'
import { Button, Input, Select, Textarea, PageHeader } from '../../../../../components/admin/ui'
import { F9Lookup, companyAdapter, warehouseAdapter } from '../../../../../components/f9'
import { useRouter } from 'next/navigation'

const LOCK_TYPES = [
  { value: 'PERIOD_LOCK', label: 'Period Lock' },
  { value: 'WAREHOUSE_LOCK', label: 'Warehouse Lock' },
  { value: 'LOCATION_LOCK', label: 'Location Lock' },
  { value: 'ITEM_LOCK', label: 'Item Lock' },
  { value: 'GLOBAL_INVENTORY_LOCK', label: 'Global Inventory Lock' },
]

export default function NewInventoryLockPage() {
  const router = useRouter()
  const { t, dir } = useTranslation()
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)
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

  const handleChange = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('inventory/locks', form as any)
      showToast('Lock created successfully', 'success')
      router.push('/admin/inventory/locks')
    } catch (err: any) {
      showToast(err.message || 'Failed to create lock', 'error')
    } finally {
      setSaving(false)
    }
  }

  const showWarehousePicker = ['WAREHOUSE_LOCK', 'LOCATION_LOCK', 'ITEM_LOCK'].includes(form.lockType)

  return (
    <div dir={dir}>
      <PageHeader title="Create Inventory Lock" actions={<Button variant="secondary" onClick={() => router.back()}>Back</Button>} />
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4 bg-white p-6 rounded-lg shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Code</label>
            <Input value={form.code} onChange={e => handleChange('code', e.target.value)} required placeholder="LOCK-001" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Lock Type</label>
            <Select value={form.lockType} onChange={e => handleChange('lockType', e.target.value)} options={LOCK_TYPES} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date From</label>
            <Input type="date" value={form.dateFrom} onChange={e => handleChange('dateFrom', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date To</label>
            <Input type="date" value={form.dateTo} onChange={e => handleChange('dateTo', e.target.value)} required />
          </div>
        </div>
        {showWarehousePicker && (
          <div>
            <label className="block text-sm font-medium mb-1">Warehouse</label>
            <F9Lookup adapter={warehouseAdapter} value={form.warehouseId} onChange={v => handleChange('warehouseId', v)} />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Reason</label>
          <Textarea value={form.reason} onChange={e => handleChange('reason', e.target.value)} required rows={3} placeholder="Reason for this lock..." />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <Textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)} rows={2} />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={() => router.back()} type="button">Cancel</Button>
          <Button type="submit" loading={saving}>Create Lock</Button>
        </div>
      </form>
    </div>
  )
}
