'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../../../../lib/api'
import { useTranslation } from '../../../../lib/i18n/use-translation'
import { useToast } from '../../../../components/admin/toast-provider'
import { Button, Input, Select, Pagination, PageHeader, EmptyState } from '../../../../components/admin/ui'

interface AuditEntry {
  id: string
  userId?: string
  action: string
  entity: string
  entityId?: string
  details?: string
  ip?: string
  userAgent?: string
  createdAt: string
  user?: { id: string; email: string; name?: string }
}

export default function InventoryGovernanceAuditPage() {
  const { t, dir } = useTranslation()
  const { showToast } = useToast()
  const [data, setData] = useState<AuditEntry[]>([])
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ action: '', startDate: '', endDate: '' })
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (filters.action) params.set('action', filters.action)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      const res: any = await api.get(`inventory/audit?${params}`)
      setData(res.data)
      setMeta(res.meta)
    } catch (err: any) {
      setError(err.message || 'Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div dir={dir}>
      <PageHeader title="Inventory Governance Audit" />
      <div className="flex gap-4 mb-4 items-end">
        <div className="w-40">
          <Select
            value={filters.action}
            onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
            options={[
              { value: '', label: 'All Actions' },
              { value: 'CREATE', label: 'CREATE' },
              { value: 'UPDATE', label: 'UPDATE' },
              { value: 'DELETE', label: 'DELETE' },
              { value: 'ACTIVATE', label: 'ACTIVATE' },
              { value: 'DEACTIVATE', label: 'DEACTIVATE' },
            ]}
            placeholder="Action"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <Input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <Input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
        </div>
        <div className="flex-1" />
        <Button onClick={() => fetchData()} variant="secondary">Refresh</Button>
      </div>
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : error ? (
        <div className="text-red-500 py-4">{error}</div>
      ) : data.length === 0 ? (
        <EmptyState message="No audit entries found. Inventory governance audit entries will appear here as actions are performed." />
      ) : (
        <>
          <table className="w-full border-collapse bg-white rounded-lg shadow-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-sm font-semibold text-gray-700">
                <th className="px-4 py-3">Date/Time</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Entity ID</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.map(entry => (
                <tr key={entry.id} className="border-b hover:bg-gray-50 text-sm">
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{entry.user?.name || entry.user?.email || entry.userId || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      entry.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                      entry.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                      entry.action === 'ACTIVATE' ? 'bg-blue-100 text-blue-800' :
                      entry.action === 'DEACTIVATE' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-700'
                    }`}>{entry.action}</span>
                  </td>
                  <td className="px-4 py-3">{entry.entity}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">{entry.entityId || '-'}</td>
                  <td className="px-4 py-3">
                    <button
                      className="text-blue-600 hover:underline text-xs"
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    >
                      {expandedId === entry.id ? 'Hide' : 'Show'}
                    </button>
                  </td>
                </tr>
              ))}
              {expandedId && data.find(e => e.id === expandedId) && (
                <tr key={`${expandedId}-detail`} className="bg-gray-50">
                  <td colSpan={6} className="px-4 py-3 text-sm text-gray-600">
                    <strong>Details:</strong> {data.find(e => e.id === expandedId)?.details || 'N/A'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={fetchData} />
        </>
      )}
    </div>
  )
}
