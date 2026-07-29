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
const getLockTypeLabel = (type: string, t: (key: string) => string) => {
  const map: Record<string, string> = {
    PERIOD_LOCK: t('inventory.periodLock'),
    WAREHOUSE_LOCK: t('inventory.warehouseLock'),
    LOCATION_LOCK: t('inventory.locationLock'),
    ITEM_LOCK: t('inventory.itemLock'),
    GLOBAL_INVENTORY_LOCK: t('inventory.globalInventoryLock'),
  }
  return map[type] || type
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
      const res: any = await api.get(`/inventory/locks?${params}`)
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
    api.delete(`/inventory/locks/${deleteTarget.id}`).then(() => {
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
      await api.post(`/inventory/locks/${id}/activate`, {})
      showToast('Lock activated', 'success')
      fetchData(meta.page)
    } catch (err: any) {
      showToast(err.message || 'Activation failed', 'error')
    }
  }

  const handleDeactivate = async (id: string) => {
    try {
      await api.post(`/inventory/locks/${id}/deactivate`, {})
      showToast('Lock deactivated', 'success')
      fetchData(meta.page)
    } catch (err: any) {
      showToast(err.message || 'Deactivation failed', 'error')
    }
  }

  return (
    <div dir={dir}>
      <PageHeader
        title={t('inventory.inventoryLocks')}
        actions={<Button onClick={() => router.push('/admin/inventory/locks/new')}>{t('inventory.createLock')}</Button>}
      />
      <div className="flex gap-4 mb-4 items-end">
        <div className="w-48">
          <Select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            options={[{ value: '', label: t('inventory.allStatuses') }, { value: 'ACTIVE', label: t('common.active') }, { value: 'INACTIVE', label: t('common.inactive') }]}
            placeholder={t('common.status')}
          />
        </div>
        <div className="w-48">
          <Select
            value={filters.lockType}
            onChange={e => setFilters(f => ({ ...f, lockType: e.target.value }))}
            options={[{ value: '', label: t('inventory.allTypes') }, ...LOCK_TYPES.map(lt => ({ value: lt, label: getLockTypeLabel(lt, t) }))]}
            placeholder={t('inventory.lockType')}
          />
        </div>
        <div className="flex-1" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('common.search')} className="w-64" />
        <Button onClick={() => fetchData()} variant="secondary">{t('common.refresh')}</Button>
      </div>
      {loading ? (
        <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>
      ) : error ? (
        <div className="text-red-500 py-4">{error}</div>
      ) : data.length === 0 ? (
        <EmptyState message={t('inventory.noLocks')} />
      ) : (
        <>
          <table className="w-full border-collapse bg-white rounded-lg shadow-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-sm font-semibold text-gray-700">
                <th className="px-4 py-3">{t('common.code')}</th>
                <th className="px-4 py-3">{t('common.type')}</th>
                <th className="px-4 py-3">{t('inventory.dateRange')}</th>
                <th className="px-4 py-3">{t('inventoryCounting.reason')}</th>
                <th className="px-4 py-3">{t('common.status')}</th>
                <th className="px-4 py-3">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map(lock => (
                <tr key={lock.id} className="border-b hover:bg-gray-50 text-sm">
                  <td className="px-4 py-3 font-medium">{lock.code}</td>
                  <td className="px-4 py-3">{getLockTypeLabel(lock.lockType, t)}</td>
                  <td className="px-4 py-3">{new Date(lock.dateFrom).toLocaleDateString()} - {new Date(lock.dateTo).toLocaleDateString()}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{lock.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${lock.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {lock.status === 'ACTIVE' ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => router.push(`/admin/inventory/locks/${lock.id}`)}>{t('common.view')}</Button>
                      {lock.status === 'INACTIVE' ? (
                        <Button size="sm" variant="primary" onClick={() => handleActivate(lock.id)}>{t('common.activate')}</Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => handleDeactivate(lock.id)}>{t('common.deactivate')}</Button>
                      )}
                      <Button size="sm" variant="danger" onClick={() => setDeleteTarget(lock)}>{t('common.delete')}</Button>
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
        title={t('common.confirmDeleteTitle')}
        message={`${t('inventory.confirmDeleteLock')} "${deleteTarget?.code}"?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
