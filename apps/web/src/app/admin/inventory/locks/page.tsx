'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../../../../lib/api'
import { useTranslation } from '../../../../lib/i18n/use-translation'
import { useToast } from '../../../../components/admin/toast-provider'
import { Button, Input, Select, Pagination, PageHeader, Modal, ConfirmDialog, EmptyState } from '../../../../components/admin/ui'
import { useRouter } from 'next/navigation'

interface InventoryLock {
  id: string
  code: string
  lockType: string
  status: string
  dateFrom: string
  dateTo: string
  warehouseId?: string
  locationId?: string
  productId?: string
  sparePartId?: string
  reason: string
  notes?: string
  createdByUserId?: string
  createdAt: string
  updatedAt: string
  activatedByUserId?: string
  activatedAt?: string
  deactivatedByUserId?: string
  deactivatedAt?: string
}

const LOCK_TYPES = ['PERIOD_LOCK', 'WAREHOUSE_LOCK', 'LOCATION_LOCK', 'ITEM_LOCK', 'GLOBAL_INVENTORY_LOCK']
const LOCK_TYPES_MAP: Record<string, string> = {
  PERIOD_LOCK: 'Period Lock',
  WAREHOUSE_LOCK: 'Warehouse Lock',
  LOCATION_LOCK: 'Location Lock',
  ITEM_LOCK: 'Item Lock',
  GLOBAL_INVENTORY_LOCK: 'Global Lock',
}

export default function InventoryLocksPage() {
  const router = useRouter()
  const { t, dir } = useTranslation()
  const { showToast } = useToast()
  const [data, setData] = useState<InventoryLock[]>([])
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ status: '', lockType: '' })
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<InventoryLock | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (filters.status) params.set('status', filters.status)
      if (filters.lockType) params.set('lockType', filters.lockType)
      if (search) params.set('search', search)
      const res: any = await api.get(`inventory/locks?${params}`)
      setData(res.data)
      setMeta(res.meta)
    } catch (err: any) {
      setError(err.message || 'Failed to load locks')
    } finally {
      setLoading(false)
    }
  }, [filters, search])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = () => {
    if (!deleteTarget) return
    setDeleting(true)
    api.delete(`inventory/locks/${deleteTarget.id}`).then(() => {
      showToast('Lock deleted', 'success')
      setDeleteTarget(null)
      fetchData(meta.page)
    }).catch((err: any) => {
      showToast(err.message || 'Delete failed', 'error')
    }).finally(() => {
      setDeleting(false)
    })
  }

  const handleActivate = async (id: string) => {
    try {
      await api.post(`inventory/locks/${id}/activate`, {})
      showToast('Lock activated', 'success')
      fetchData(meta.page)
    } catch (err: any) {
      showToast(err.message || 'Activation failed', 'error')
    }
  }

  const handleDeactivate = async (id: string) => {
    try {
      await api.post(`inventory/locks/${id}/deactivate`, {})
      showToast('Lock deactivated', 'success')
      fetchData(meta.page)
    } catch (err: any) {
      showToast(err.message || 'Deactivation failed', 'error')
    }
  }

  return (
    <div dir={dir}>
      <PageHeader
        title="Inventory Locks"
        actions={<Button onClick={() => router.push('/admin/inventory/locks/new')}>Create Lock</Button>}
      />
      <div className="flex gap-4 mb-4 items-end">
        <div className="w-48">
          <Select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            options={[{ value: '', label: 'All Status' }, { value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]}
            placeholder="Status"
          />
        </div>
        <div className="w-48">
          <Select
            value={filters.lockType}
            onChange={e => setFilters(f => ({ ...f, lockType: e.target.value }))}
            options={[{ value: '', label: 'All Types' }, ...LOCK_TYPES.map(lt => ({ value: lt, label: LOCK_TYPES_MAP[lt] }))]}
            placeholder="Lock Type"
          />
        </div>
        <div className="flex-1" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-64" />
        <Button onClick={() => fetchData()} variant="secondary">Refresh</Button>
      </div>
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : error ? (
        <div className="text-red-500 py-4">{error}</div>
      ) : data.length === 0 ? (
        <EmptyState message="No locks found. Create your first inventory lock to start governing inventory operations." />
      ) : (
        <>
          <table className="w-full border-collapse bg-white rounded-lg shadow-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-sm font-semibold text-gray-700">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date Range</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map(lock => (
                <tr key={lock.id} className="border-b hover:bg-gray-50 text-sm">
                  <td className="px-4 py-3 font-medium">{lock.code}</td>
                  <td className="px-4 py-3">{LOCK_TYPES_MAP[lock.lockType] || lock.lockType}</td>
                  <td className="px-4 py-3">{new Date(lock.dateFrom).toLocaleDateString()} - {new Date(lock.dateTo).toLocaleDateString()}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{lock.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${lock.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {lock.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => router.push(`/admin/inventory/locks/${lock.id}`)}>View</Button>
                      {lock.status === 'INACTIVE' ? (
                        <Button size="sm" variant="primary" onClick={() => handleActivate(lock.id)}>Activate</Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => handleDeactivate(lock.id)}>Deactivate</Button>
                      )}
                      <Button size="sm" variant="danger" onClick={() => setDeleteTarget(lock)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Lock"
        message={`Are you sure you want to delete lock "${deleteTarget?.code}"?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
