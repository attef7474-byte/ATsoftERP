'use client'
import React, { useState, useEffect } from 'react'
import { api } from '../../../../../lib/api'
import { useTranslation } from '../../../../../lib/i18n/use-translation'
import { useToast } from '../../../../../components/admin/toast-provider'
import { Button, PageHeader, Modal, Textarea, Input, Select } from '../../../../../components/admin/ui'
import { useRouter, useParams } from 'next/navigation'

const LOCK_TYPES_MAP: Record<string, string> = {
  PERIOD_LOCK: 'Period Lock',
  WAREHOUSE_LOCK: 'Warehouse Lock',
  LOCATION_LOCK: 'Location Lock',
  ITEM_LOCK: 'Item Lock',
  GLOBAL_INVENTORY_LOCK: 'Global Lock',
}

export default function InventoryLockDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { t, dir } = useTranslation()
  const { showToast } = useToast()
  const [lock, setLock] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res: any = await api.get(`/inventory/locks/${params.id}`)
        setLock(res)
      } catch (err: any) {
        setError(err.message || 'Failed to load lock')
      } finally {
        setLoading(false)
      }
    })()
  }, [params.id])

  const openEdit = () => {
    if (!lock) return
    setForm({
      code: lock.code,
      lockType: lock.lockType,
      dateFrom: lock.dateFrom.split('T')[0],
      dateTo: lock.dateTo.split('T')[0],
      reason: lock.reason,
      notes: lock.notes || '',
    })
    setEditOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await api.patch(`/inventory/locks/${params.id}`, form)
      setLock(updated)
      showToast('Lock updated', 'success')
      setEditOpen(false)
    } catch (err: any) {
      showToast(err.message || 'Update failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async () => {
    try {
      const updated = await api.post(`/inventory/locks/${params.id}/activate`, {})
      setLock(updated)
      showToast('Lock activated', 'success')
    } catch (err: any) {
      showToast(err.message || 'Activation failed', 'error')
    }
  }

  const handleDeactivate = async () => {
    try {
      const updated = await api.post(`/inventory/locks/${params.id}/deactivate`, {})
      setLock(updated)
      showToast('Lock deactivated', 'success')
    } catch (err: any) {
      showToast(err.message || 'Deactivation failed', 'error')
    }
  }

  if (loading) return <div className="text-center py-8">Loading...</div>
  if (error) return <div className="text-red-500 py-4">{error}</div>
  if (!lock) return <div className="text-center py-8">Not found</div>

  return (
    <div dir={dir}>
      <PageHeader
        title={`Lock: ${lock.code}`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push('/admin/inventory/locks')}>Back</Button>
            <Button onClick={() => setEditOpen(true)}>Edit</Button>
            {lock.status === 'ACTIVE' ? (
              <Button variant="secondary" onClick={handleDeactivate}>Deactivate</Button>
            ) : (
              <Button variant="primary" onClick={handleActivate}>Activate</Button>
            )}
          </div>
        }
      />
      <div className="bg-white rounded-lg shadow-sm p-6 max-w-2xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><span className="text-sm text-gray-500">Code:</span><p className="font-medium">{lock.code}</p></div>
          <div><span className="text-sm text-gray-500">Type:</span><p className="font-medium">{LOCK_TYPES_MAP[lock.lockType] || lock.lockType}</p></div>
          <div><span className="text-sm text-gray-500">Status:</span><p className="font-medium"><span className={`px-2 py-1 rounded-full text-xs ${lock.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{lock.status}</span></p></div>
          <div><span className="text-sm text-gray-500">Date From:</span><p className="font-medium">{new Date(lock.dateFrom).toLocaleDateString()}</p></div>
          <div><span className="text-sm text-gray-500">Date To:</span><p className="font-medium">{new Date(lock.dateTo).toLocaleDateString()}</p></div>
          <div><span className="text-sm text-gray-500">Created:</span><p className="font-medium">{new Date(lock.createdAt).toLocaleString()}</p></div>
        </div>
        <div><span className="text-sm text-gray-500">Reason:</span><p className="mt-1">{lock.reason}</p></div>
        {lock.notes && <div><span className="text-sm text-gray-500">Notes:</span><p className="mt-1">{lock.notes}</p></div>}
        {lock.activatedAt && <div><span className="text-sm text-gray-500">Activated At:</span><p className="font-medium">{new Date(lock.activatedAt).toLocaleString()}</p></div>}
        {lock.deactivatedAt && <div><span className="text-sm text-gray-500">Deactivated At:</span><p className="font-medium">{new Date(lock.deactivatedAt).toLocaleString()}</p></div>}
      </div>
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Lock">
        <div className="space-y-4">
          <Input label="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
          <Input label="Date From" type="date" value={form.dateFrom} onChange={e => setForm(f => ({ ...f, dateFrom: e.target.value }))} />
          <Input label="Date To" type="date" value={form.dateTo} onChange={e => setForm(f => ({ ...f, dateTo: e.target.value }))} />
          <Textarea label="Reason" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
