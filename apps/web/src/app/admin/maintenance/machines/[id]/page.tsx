'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api';
import { useTranslation } from '../../../../../lib/i18n/use-translation';
import { useToast } from '../../../../../components/admin/toast-provider';
import { Machine, MachinePart, MachineDocument, MaintenanceRequest, BarcodeLabel } from '../../../../../lib/admin-types';
import { Card, CardContent, CardHeader, DataTable, LoadingState, ErrorState, StatusBadge, Button, Modal, Input, ConfirmDialog } from '../../../../../components/admin/ui';
import { useRegisterAdminActions, useStableHandlers, ActionBackIcon, ActionRefreshIcon, ActionEditIcon, ActionActivateIcon, ActionDeactivateIcon } from '../../../../../components/admin/admin-action-bar';
import { F9Lookup, sparePartAdapter } from '../../../../../components/f9';

interface MachineDetail extends Machine {
  parts?: MachinePart[];
  documents?: MachineDocument[];
}

export default function MachineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { showToast } = useToast();
  const id = params.id as string;
  const [data, setData] = useState<MachineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [labels, setLabels] = useState<BarcodeLabel[]>([]);
  const [machineSpareLinks, setMachineSpareLinks] = useState<any[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [editingMachineLink, setEditingMachineLink] = useState<any | null>(null);
  const [linkForm, setLinkForm] = useState({ sparePartId: '', quantity: 1, unit: '', usageNote: '', isPrimary: false });
  const [savingLink, setSavingLink] = useState(false);
  const [deleteLinkId, setDeleteLinkId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get<Machine>(`/maintenance/machines/${id}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || t('errors.loadFailed'));
    } finally { setLoading(false); }
  }, [id, t]);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get<{ data: MaintenanceRequest[] }>(`/maintenance/requests`, { params: { machineId: id, limit: 20 } });
      setRequests(res.data || []);
    } catch (_) { setRequests([]); }
  }, [id]);

  const fetchLabels = useCallback(async () => {
    try {
      const res = await api.get<{ data: BarcodeLabel[] }>(`/barcodes/entities/MACHINE/${id}/labels`);
      setLabels(res.data || []);
    } catch (_) { setLabels([]); }
  }, [id]);

  const fetchMachineSpareLinks = useCallback(async () => {
    setLinksLoading(true);
    try {
      const res = await api.get<any[]>(`/maintenance/machine-spare-parts?machineId=${id}`);
      setMachineSpareLinks(res);
    } catch { }
    finally { setLinksLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); fetchRequests(); fetchLabels(); fetchMachineSpareLinks(); }, [fetchData, fetchRequests, fetchLabels, fetchMachineSpareLinks]);

  const handleStatusChange = async (newStatus: string) => {
    try { await api.patch(`/maintenance/machines/${id}`, { status: newStatus }); fetchData(); showToast(t('common.successUpdated'), 'success'); } catch (err: any) { showToast(err?.message, 'error'); }
  };

  const openNewMachineLink = useCallback(() => {
    setEditingMachineLink(null);
    setLinkForm({ sparePartId: '', quantity: 1, unit: '', usageNote: '', isPrimary: false });
    setLinkModalOpen(true);
  }, []);

  const openEditMachineLink = useCallback((link: any) => {
    setEditingMachineLink(link);
    setLinkForm({ sparePartId: link.sparePartId, quantity: link.quantity, unit: link.unit || '', usageNote: link.usageNote || '', isPrimary: link.isPrimary });
    setLinkModalOpen(true);
  }, []);

  const handleSaveMachineLink = async () => {
    if (!linkForm.sparePartId) { showToast(t('validation.required'), 'error'); return; }
    setSavingLink(true);
    try {
      const payload = { ...linkForm, machineId: id };
      if (editingMachineLink) {
        await api.patch(`/maintenance/machine-spare-parts/${editingMachineLink.id}`, payload);
      } else {
        await api.post('/maintenance/machine-spare-parts', payload);
      }
      showToast(editingMachineLink ? t('maintenance.machineSparePartUpdated') : t('maintenance.machineSparePartCreated'), 'success');
      setLinkModalOpen(false);
      fetchMachineSpareLinks();
    } catch (e: any) { showToast(e.message || 'Save failed', 'error'); }
    finally { setSavingLink(false); }
  };

  const handleDeleteMachineLink = async () => {
    if (!deleteLinkId) return;
    try {
      await api.delete(`/maintenance/machine-spare-parts/${deleteLinkId}`);
      showToast(t('maintenance.machineSparePartDeactivated'), 'success');
      setDeleteLinkId(null);
      fetchMachineSpareLinks();
    } catch (e: any) { showToast(e.message, 'error'); }
  };

  const { exec } = useStableHandlers({
    back: () => router.back(),
    refresh: () => { fetchData(); fetchRequests(); fetchLabels(); },
    edit: () => router.push(`/admin/maintenance/machines/${id}/edit`),
    activate: () => handleStatusChange('ACTIVE'),
    deactivate: () => handleStatusChange('INACTIVE'),
  });

  useRegisterAdminActions([
    { id: 'back', labelKey: 'common.back', icon: <ActionBackIcon />, onClick: () => exec('back') },
    { id: 'refresh', labelKey: 'common.refresh', icon: <ActionRefreshIcon />, onClick: () => exec('refresh') },
    { id: 'edit', labelKey: 'common.edit', icon: <ActionEditIcon />, onClick: () => exec('edit'), enabled: !!data },
    { id: 'activate', labelKey: 'common.activate', icon: <ActionActivateIcon />, onClick: () => exec('activate'), enabled: !!(data && data.status !== 'ACTIVE') },
    { id: 'deactivate', labelKey: 'common.deactivate', icon: <ActionDeactivateIcon />, onClick: () => exec('deactivate'), enabled: !!(data && data.status === 'ACTIVE') },
  ]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;
  if (!data) return <ErrorState message={t('details.notFound')} onRetry={() => router.back()} />;

  const tabs = [
    { id: 'overview', label: t('details.overview') },
    { id: 'parts', label: t('details.machine.parts') },
    { id: 'spareParts', label: t('maintenance.spareParts') },
    { id: 'documents', label: t('details.machine.documents') },
    { id: 'requests', label: t('details.machine.requests') },
    { id: 'labels', label: t('details.machine.labels') },
    { id: 'maintenanceLog', label: t('maintenanceWorkflow.machineMaintenanceLog') },
    { id: 'downtime', label: t('maintenanceWorkflow.machineDowntimeLink') },
    { id: 'qr', label: t('maintenanceWorkflow.machineQRLabel') },
  ];

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><dt className="text-sm font-medium text-gray-500">{t('details.machine.code')}</dt><dd className="mt-1 text-sm text-gray-900">{data.code}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.machine.name')}</dt><dd className="mt-1 text-sm text-gray-900 font-semibold">{data.name}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt><dd className="mt-1"><StatusBadge status={data.status} /></dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.machine.category')}</dt><dd className="mt-1 text-sm text-gray-900">{data.category?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.machine.model')}</dt><dd className="mt-1 text-sm text-gray-900">{data.model || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.machine.serialNumber')}</dt><dd className="mt-1 text-sm text-gray-900 font-mono">{data.serialNumber || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.machine.manufacturer')}</dt><dd className="mt-1 text-sm text-gray-900">{data.manufacturer || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('details.machine.location')}</dt><dd className="mt-1 text-sm text-gray-900">{data.location || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('core.company')}</dt><dd className="mt-1 text-sm text-gray-900">{data.company?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('core.branch')}</dt><dd className="mt-1 text-sm text-gray-900">{data.branch?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('core.department')}</dt><dd className="mt-1 text-sm text-gray-900">{data.department?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.productionLine')}</dt><dd className="mt-1 text-sm text-gray-900">{data.productionLine?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.operationType')}</dt><dd className="mt-1 text-sm text-gray-900">{data.operationType?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.technicalAdministration')}</dt><dd className="mt-1 text-sm text-gray-900">{data.technicalAdministration?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.technicalDepartment')}</dt><dd className="mt-1 text-sm text-gray-900">{data.technicalDepartment?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('maintenance.defaultCostCenter')}</dt><dd className="mt-1 text-sm text-gray-900">{data.defaultCostCenter?.name || '-'}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.createdAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.createdAt)}</dd></div>
            <div><dt className="text-sm font-medium text-gray-500">{t('common.updatedAt')}</dt><dd className="mt-1 text-sm text-gray-900">{fmt(data.updatedAt)}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <Card><CardContent><p className="text-sm text-gray-500">{data.notes || t('details.overview')}</p></CardContent></Card>
      )}

      {activeTab === 'parts' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.machine.parts')}</h3></CardHeader>
          <CardContent>
            {!data.parts || data.parts.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'code', header: t('common.code'), render: (p: MachinePart) => p.code },
                { key: 'name', header: t('common.name'), render: (p: MachinePart) => p.name },
                { key: 'quantity', header: t('maintenance.quantity'), render: (p: MachinePart) => p.quantity },
                { key: 'unit', header: t('maintenance.unit'), render: (p: MachinePart) => p.unit || '-' },
                { key: 'status', header: t('common.status'), render: (p: MachinePart) => <StatusBadge status={p.status} /> },
              ]} data={data.parts} keyExtractor={(p: MachinePart) => p.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'spareParts' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">{t('maintenance.spareParts')} ({machineSpareLinks.length})</h3>
            <Button onClick={openNewMachineLink} size="sm">{t('common.add')}</Button>
          </CardHeader>
          <CardContent>
            {linksLoading ? (
              <p className="text-sm text-gray-500 py-4">{t('common.loading')}</p>
            ) : machineSpareLinks.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">{t('maintenance.noMachineSpareParts')}</p>
            ) : (
              <DataTable columns={[
                { key: 'sparePartName', header: t('maintenance.sparePart.form.name'), render: (l: any) => l.sparePart?.name || '-' },
                { key: 'sparePartCode', header: t('maintenance.sparePart.form.code'), render: (l: any) => l.sparePart?.code || '-' },
                { key: 'quantity', header: t('maintenance.sparePart.form.quantity'), render: (l: any) => l.quantity },
                { key: 'unit', header: t('maintenance.sparePart.form.unit'), render: (l: any) => l.unit || '-' },
                { key: 'isPrimary', header: t('maintenance.sparePart.form.isPrimary'), render: (l: any) => l.isPrimary ? 'Yes' : 'No' },
                { key: 'actions', header: '', render: (l: any) => (
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); openEditMachineLink(l); }} className="text-blue-600 hover:text-blue-800 text-sm">{t('actions.edit')}</button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteLinkId(l.id); }} className="text-red-600 hover:text-red-800 text-sm">{t('actions.deactivate')}</button>
                  </div>
                )},
              ]} data={machineSpareLinks} keyExtractor={(l: any) => l.id}
                onRowClick={(l) => router.push(`/admin/maintenance/spare-parts/${l.sparePartId}`)} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'documents' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.machine.documents')}</h3></CardHeader>
          <CardContent>
            {!data.documents || data.documents.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'title', header: t('common.name'), render: (d: MachineDocument) => d.title },
                { key: 'type', header: t('maintenance.documentType'), render: (d: MachineDocument) => d.documentType || '-' },
                { key: 'fileName', header: t('maintenance.fileName'), render: (d: MachineDocument) => d.fileName || '-' },
                { key: 'createdAt', header: t('common.createdAt'), render: (d: MachineDocument) => fmt(d.createdAt) },
              ]} data={data.documents} keyExtractor={(d: MachineDocument) => d.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'requests' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.machine.requests')}</h3></CardHeader>
          <CardContent>
            {requests.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'requestNumber', header: t('maintenance.requestNumber'), render: (r: MaintenanceRequest) => r.requestNumber },
                { key: 'title', header: t('common.name'), render: (r: MaintenanceRequest) => r.title },
                { key: 'type', header: t('maintenance.maintenanceType'), render: (r: MaintenanceRequest) => t('status.' + r.type) },
                { key: 'priority', header: t('maintenance.priority'), render: (r: MaintenanceRequest) => r.priority },
                { key: 'status', header: t('common.status'), render: (r: MaintenanceRequest) => <StatusBadge status={r.status} /> },
              ]} data={requests} keyExtractor={(r: MaintenanceRequest) => r.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'labels' && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-700">{t('details.machine.labels')}</h3></CardHeader>
          <CardContent>
            {labels.length === 0 ? <p className="text-sm text-gray-500 py-4">{t('common.noData')}</p> : (
              <DataTable columns={[
                { key: 'code', header: t('barcodes.labelCode'), render: (l: BarcodeLabel) => l.code },
                { key: 'value', header: t('barcodes.labelValue'), render: (l: BarcodeLabel) => l.value },
                { key: 'symbology', header: t('barcodes.symbology'), render: (l: BarcodeLabel) => l.symbology },
                { key: 'status', header: t('common.status'), render: (l: BarcodeLabel) => <StatusBadge status={l.status} /> },
              ]} data={labels} keyExtractor={(l: BarcodeLabel) => l.id} />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'maintenanceLog' && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-sm text-gray-500 mb-4">{t('maintenanceWorkflow.maintenanceLogDescription')}</p>
            <button onClick={() => router.push(`/admin/maintenance/machines/${id}/maintenance-log`)} className="text-blue-600 hover:text-blue-800 font-medium">{t('maintenanceWorkflow.machineMaintenanceLog')}</button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'downtime' && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-sm text-gray-500 mb-4">{t('maintenanceWorkflow.machineDowntimeDescription')}</p>
            <button onClick={() => router.push(`/admin/maintenance/machines/${id}/downtime`)} className="text-blue-600 hover:text-blue-800 font-medium">{t('maintenanceWorkflow.machineDowntimeLink')}</button>
          </CardContent>
        </Card>
      )}

      {activeTab === 'qr' && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-sm text-gray-500 mb-4">{t('maintenanceWorkflow.machineQRDescription')}</p>
            <button onClick={() => router.push(`/admin/maintenance/machines/${id}/qr`)} className="text-blue-600 hover:text-blue-800 font-medium">{t('maintenanceWorkflow.machineQRLabel')}</button>
          </CardContent>
        </Card>
      )}

      <Modal open={linkModalOpen} onClose={() => setLinkModalOpen(false)} title={editingMachineLink ? t('common.edit') : t('common.add')}>
        <div className="space-y-4">
          <F9Lookup
            label={t('maintenance.sparePart.form.selectSparePart')}
            adapter={sparePartAdapter}
            value={linkForm.sparePartId}
            onChange={(val) => setLinkForm({ ...linkForm, sparePartId: val })}
          />
          <Input label={t('maintenance.sparePart.form.quantity')} type="number" value={linkForm.quantity} onChange={(e) => setLinkForm({ ...linkForm, quantity: Number(e.target.value) })} />
          <Input label={t('maintenance.sparePart.form.unit')} value={linkForm.unit} onChange={(e) => setLinkForm({ ...linkForm, unit: e.target.value })} />
          <Input label={t('maintenance.sparePart.form.usageNote')} value={linkForm.usageNote} onChange={(e) => setLinkForm({ ...linkForm, usageNote: e.target.value })} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={linkForm.isPrimary} onChange={(e) => setLinkForm({ ...linkForm, isPrimary: e.target.checked })} className="rounded" />
            {t('maintenance.sparePart.form.isPrimary')}
          </label>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setLinkModalOpen(false)}>{t('actions.cancel')}</Button>
            <Button onClick={handleSaveMachineLink} disabled={savingLink} variant="primary">{savingLink ? t('common.saving') : t('actions.save')}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={!!deleteLinkId}
        onClose={() => setDeleteLinkId(null)}
        onConfirm={handleDeleteMachineLink}
        title={t('maintenance.deactivateMachineSparePart')}
        message={t('maintenance.confirmDeactivateMachineSparePart')}
      />
    </div>
  );
}
