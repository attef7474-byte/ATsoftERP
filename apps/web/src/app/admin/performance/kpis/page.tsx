'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/use-translation';
import { useToast } from '@/components/admin/toast-provider';
import { Button, Input, Card, LoadingState, Modal, StatusBadge, Pagination } from '@/components/admin/ui';
import { Search, Plus, Edit, RefreshCw, BarChart3, Power, PowerOff, Play } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const DOMAINS = ['MAINTENANCE_EXECUTION','MAINTENANCE_RELIABILITY','MAINTENANCE_PREVENTIVE','PRODUCTION_OUTPUT','PRODUCTION_EFFICIENCY','PRODUCTION_QUALITY','PRODUCTION_DOWNTIME','OPERATIONAL_DISCIPLINE','GENERAL'];
const UNITS = ['COUNT','PERCENT','MINUTES','HOURS','QUANTITY','RATE','RATIO','BOOLEAN_RATE'];
const DIRECTIONS = ['HIGHER_IS_BETTER','LOWER_IS_BETTER','TARGET_IS_BEST','INFORMATIONAL'];
const AGGS = ['SUM','COUNT','AVERAGE','WEIGHTED_AVERAGE','RATIO','PERCENTAGE','MEDIAN','DURATION_AVERAGE','LATEST'];
const MODES = ['CANONICAL_SERVICE','FORMULA','COUNT_QUERY','RATIO_QUERY','DERIVED_FROM_CANONICAL_ANALYTICS'];
const STATUSES = ['DRAFT','ACTIVE','DEPRECATED'];

const emptyKpi = { code:'', name:'', nameAr:'', nameEn:'', description:'', descriptionAr:'', descriptionEn:'', domain:'GENERAL', measurementUnit:'COUNT', direction:'HIGHER_IS_BETTER', aggregationType:'COUNT', calculationMode:'COUNT_QUERY', sourceContractKey:'', calculationVersion:1, status:'DRAFT', isActive:false, notes:'' };

export default function PerformanceKpisPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { permissions, isSuperAdmin } = useAuth();
  const can = useCallback((p: string) => isSuperAdmin || Boolean(permissions?.permissions.includes(p)), [isSuperAdmin, permissions]);
  const canCreate = can('performance-kpi:create');
  const canUpdate = can('performance-kpi:update');
  const canDeactivate = can('performance-kpi:deactivate');
  const canPreview = can('performance-kpi-preview:read');

  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyKpi);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewForm, setPreviewForm] = useState({ operationalPersonId:'', dateFrom:'', dateTo:'' });
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  const fetchData = useCallback(async (page = 1, q = '') => {
    setLoading(true);
    try {
      const res = await api.get('/performance/kpis', { params: { page, limit: 20, search: q || undefined } }) as any;
      setData(res.data || []);
      setMeta(res.meta || { page: 1, limit: 20, total: 0, totalPages: 0 });
      if (selected) { const fresh = (res.data || []).find((x: any) => x.id === selected.id); if (fresh) setSelected(fresh); }
    } catch (e: any) { showToast(e?.response?.data?.message || t('errors.loadFailed'), 'error'); }
    finally { setLoading(false); }
  }, [selected, showToast, t]);

  const fetchEmployees = useCallback(async () => {
    try { const res = await api.get('/core/operational-people', { params: { page: 1, limit: 100, isActive: 'true' } }) as any; setEmployees(res.data || res.items || []); } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData(1, ''); fetchEmployees(); }, []); // eslint-disable-line

  const openCreate = () => { setEditingId(null); setForm(emptyKpi); setErrors({}); setModalOpen(true); };
  const openEdit = (k: any) => { setEditingId(k.id); setForm({ code:k.code,name:k.name,nameAr:k.nameAr||'',nameEn:k.nameEn||'',description:k.description||'',descriptionAr:k.descriptionAr||'',descriptionEn:k.descriptionEn||'',domain:k.domain,measurementUnit:k.measurementUnit,direction:k.direction,aggregationType:k.aggregationType,calculationMode:k.calculationMode,sourceContractKey:k.sourceContractKey,calculationVersion:k.calculationVersion||1,status:k.status,isActive:!!k.isActive,notes:k.notes||'' }); setErrors({}); setModalOpen(true); };

  const save = async () => {
    const e: Record<string,string> = {};
    if (!form.code?.trim()) e.code = t('validation.required');
    if (!form.name?.trim()) e.name = t('validation.required');
    if (!form.sourceContractKey?.trim()) e.sourceContractKey = t('validation.required');
    setErrors(e); if (Object.keys(e).length) return;
    setSaving(true);
    try {
      if (editingId) await api.patch(`/performance/kpis/${editingId}`, form);
      else await api.post('/performance/kpis', form);
      showToast(editingId ? t('common.successUpdated') : t('common.successCreated'), 'success');
      setModalOpen(false); await fetchData(meta.page, search);
    } catch (err: any) {
      const fe = err?.response?.data?.errors; if (fe?.length) { const m:any={}; fe.forEach((x:any)=>m[x.field]=x.message); setErrors(m); }
      else showToast(err?.response?.data?.message || t('errors.saveFailed'), 'error');
    } finally { setSaving(false); }
  };

  const toggle = async (k: any) => {
    try { await api.post(`/performance/kpis/${k.id}/${k.isActive ? 'deactivate' : 'activate'}`, {}); showToast(t('common.successUpdated'), 'success'); await fetchData(meta.page, search); }
    catch (err: any) { showToast(err?.response?.data?.message || t('errors.saveFailed'), 'error'); }
  };

  const selectKpi = async (id: string) => { try { const res = await api.get(`/performance/kpis/${id}`) as any; setSelected(res); } catch (e:any) { showToast(e?.response?.data?.message || t('errors.loadFailed'), 'error'); } };

  const openPreview = (k: any) => { setSelected(k); setPreviewForm({ operationalPersonId:'', dateFrom: new Date(Date.now()-30*86400000).toISOString().slice(0,10), dateTo: new Date().toISOString().slice(0,10) }); setPreviewResult(null); setPreviewOpen(true); };
  const runPreview = async () => {
    if (!selected || !previewForm.operationalPersonId || !previewForm.dateFrom || !previewForm.dateTo) return;
    setPreviewLoading(true); setPreviewResult(null);
    try {
      const res = await api.post('/performance/kpis/preview', { operationalPersonId: previewForm.operationalPersonId, kpiCode: selected.code, dateFrom: new Date(previewForm.dateFrom).toISOString(), dateTo: new Date(previewForm.dateTo+'T23:59:59.999Z').toISOString() }) as any;
      setPreviewResult(res);
    } catch (e:any) { showToast(e?.response?.data?.message || t('errors.loadFailed'), 'error'); }
    finally { setPreviewLoading(false); }
  };

  const L = (key: string, fallback: string) => t(key) || fallback;
  const dirLabel = (d: string) => L(`core.performance.dir_${d}`, d);
  const unitLabel = (u: string) => L(`core.performance.unit_${u}`, u);
  const domLabel = (d: string) => L(`core.performance.domain_${d}`, d);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3"><BarChart3 className="h-6 w-6 text-blue-600" /><div><h1 className="text-2xl font-bold">{L('core.performance.kpiLibrary','Performance KPIs')}</h1><p className="text-sm text-gray-500">{L('core.performance.noScore','Raw metric only. No score/weight/ranking in Phase 2.')}</p></div></div>
          <div className="flex items-center gap-2">
            <Button onClick={() => fetchData(meta.page, search)} variant="secondary" size="sm"><RefreshCw className="h-4 w-4" /></Button>
            {canCreate && <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" />{L('core.performance.createKpi','New KPI')}</Button>}
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          <Input placeholder={t('grid.searchPlaceholder')} value={search} onChange={(e:any)=>setSearch(e.target.value)} onKeyDown={(e:any)=>e.key==='Enter' && fetchData(1,search)} />
          <Button onClick={() => fetchData(1,search)} variant="secondary"><Search className="h-4 w-4" /></Button>
        </div>
        {loading ? <LoadingState /> : (
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b text-left">
            <th className="py-2 px-2">{L('core.performance.kpiCode','Code')}</th><th className="py-2 px-2">{L('core.performance.kpiName','Name')}</th><th className="py-2 px-2">{L('core.performance.domain','Domain')}</th><th className="py-2 px-2">{L('core.performance.measurementUnit','Unit')}</th><th className="py-2 px-2">{L('core.performance.direction','Direction')}</th><th className="py-2 px-2">{L('common.status','Status')}</th><th className="py-2 px-2">{L('common.actions','Actions')}</th>
          </tr></thead><tbody>
            {data.map((k:any)=>(
              <tr key={k.id} className={`border-b hover:bg-gray-50 cursor-pointer ${selected?.id===k.id?'bg-blue-50':''}`} onClick={()=>selectKpi(k.id)}>
                <td className="py-2 px-2 font-mono">{k.code}</td>
                <td className="py-2 px-2">{k.nameAr || k.name}{k.nameEn ? <span className="text-gray-400 text-xs ms-2">{k.nameEn}</span> : null}</td>
                <td className="py-2 px-2">{domLabel(k.domain)}</td>
                <td className="py-2 px-2">{unitLabel(k.measurementUnit)}</td>
                <td className="py-2 px-2">{dirLabel(k.direction)}</td>
                <td className="py-2 px-2"><StatusBadge status={k.isActive?'ACTIVE':'INACTIVE'} /></td>
                <td className="py-2 px-2" onClick={(e)=>e.stopPropagation()}><div className="flex gap-1">
                  {canPreview && k.isActive && <Button size="sm" variant="secondary" onClick={()=>openPreview(k)}><Play className="h-4 w-4" /></Button>}
                  {canUpdate && <Button size="sm" variant="secondary" onClick={()=>openEdit(k)}><Edit className="h-4 w-4" /></Button>}
                  {canDeactivate && <Button size="sm" variant="secondary" onClick={()=>toggle(k)}>{k.isActive?<PowerOff className="h-4 w-4"/>:<Power className="h-4 w-4"/>}</Button>}
                </div></td>
              </tr>
            ))}
            {data.length===0 && <tr><td colSpan={7} className="py-6 text-center text-gray-500">{t('common.noData')}</td></tr>}
          </tbody></table></div>
        )}
        <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={(p)=>fetchData(p,search)} />
      </Card>

      {selected && !modalOpen && (
        <Card>
          <h2 className="text-lg font-semibold mb-3">{L('core.performance.kpi','KPI')}: {selected.code}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div><span className="text-gray-500">{L('core.performance.kpiName','Name')}</span><div className="font-medium">{selected.nameAr || selected.name}</div></div>
            <div><span className="text-gray-500">{L('core.performance.domain','Domain')}</span><div>{domLabel(selected.domain)}</div></div>
            <div><span className="text-gray-500">{L('core.performance.measurementUnit','Unit')}</span><div>{unitLabel(selected.measurementUnit)}</div></div>
            <div><span className="text-gray-500">{L('core.performance.direction','Direction')}</span><div>{dirLabel(selected.direction)}</div></div>
            <div><span className="text-gray-500">{L('core.performance.aggregationType','Aggregation')}</span><div>{L(`core.performance.agg_${selected.aggregationType}`,selected.aggregationType)}</div></div>
            <div><span className="text-gray-500">{L('core.performance.calculationMode','Mode')}</span><div>{L(`core.performance.mode_${selected.calculationMode}`,selected.calculationMode)}</div></div>
            <div><span className="text-gray-500">{L('core.performance.sourceContractKey','Source Contract')}</span><div className="font-mono text-xs">{selected.sourceContractKey}</div></div>
            <div><span className="text-gray-500">{L('core.performance.calculationVersion','Version')}</span><div>{selected.calculationVersion ?? 1}</div></div>
            <div><span className="text-gray-500">{L('common.status','Status')}</span><div>{L(`core.performance.status_${selected.status}`, selected.status)}</div></div>
          </div>
          {selected.description && <p className="mt-3 text-sm text-gray-600">{selected.descriptionAr || selected.description}</p>}
        </Card>
      )}

      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editingId ? L('core.performance.editKpi','Edit KPI') : L('core.performance.createKpi','New KPI')}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label={L('core.performance.kpiCode','Code')} value={form.code} disabled={!!editingId} onChange={(e:any)=>setForm({...form,code:e.target.value})} error={errors.code} />
            <Input label={L('core.performance.kpiName','Name')} value={form.name} onChange={(e:any)=>setForm({...form,name:e.target.value})} error={errors.name} />
            <Input label={L('core.performance.nameAr','Name Ar')} value={form.nameAr} onChange={(e:any)=>setForm({...form,nameAr:e.target.value})} />
            <Input label={L('core.performance.nameEn','Name En')} value={form.nameEn} onChange={(e:any)=>setForm({...form,nameEn:e.target.value})} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-sm">{L('core.performance.domain','Domain')}<select className="mt-1 w-full border rounded px-2 py-2" value={form.domain} onChange={(e)=>setForm({...form,domain:e.target.value})}>{DOMAINS.map(d=><option key={d} value={d}>{domLabel(d)}</option>)}</select></label>
            <label className="text-sm">{L('core.performance.measurementUnit','Unit')}<select className="mt-1 w-full border rounded px-2 py-2" value={form.measurementUnit} onChange={(e)=>setForm({...form,measurementUnit:e.target.value})}>{UNITS.map(u=><option key={u} value={u}>{unitLabel(u)}</option>)}</select></label>
            <label className="text-sm">{L('core.performance.direction','Direction')}<select className="mt-1 w-full border rounded px-2 py-2" value={form.direction} onChange={(e)=>setForm({...form,direction:e.target.value})}>{DIRECTIONS.map(d=><option key={d} value={d}>{dirLabel(d)}</option>)}</select></label>
            <label className="text-sm">{L('core.performance.aggregationType','Aggregation')}<select className="mt-1 w-full border rounded px-2 py-2" value={form.aggregationType} onChange={(e)=>setForm({...form,aggregationType:e.target.value})}>{AGGS.map(a=><option key={a} value={a}>{L(`core.performance.agg_${a}`,a)}</option>)}</select></label>
            <label className="text-sm">{L('core.performance.calculationMode','Mode')}<select className="mt-1 w-full border rounded px-2 py-2" value={form.calculationMode} onChange={(e)=>setForm({...form,calculationMode:e.target.value})}>{MODES.map(m=><option key={m} value={m}>{L(`core.performance.mode_${m}`,m)}</option>)}</select></label>
            <label className="text-sm">{L('common.status','Status')}<select className="mt-1 w-full border rounded px-2 py-2" value={form.status} onChange={(e)=>setForm({...form,status:e.target.value,isActive:e.target.value==='ACTIVE'})}>{STATUSES.map(s=><option key={s} value={s}>{L(`core.performance.status_${s}`,s)}</option>)}</select></label>
          </div>
          <Input label={L('core.performance.sourceContractKey','Source Contract Key')} value={form.sourceContractKey} onChange={(e:any)=>setForm({...form,sourceContractKey:e.target.value})} error={errors.sourceContractKey} />
          <Input label={L('core.performance.description','Description')} value={form.description} onChange={(e:any)=>setForm({...form,description:e.target.value})} />
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={()=>setModalOpen(false)}>{t('common.cancel')}</Button><Button onClick={save} disabled={saving}>{saving?t('common.saving'):t('common.save')}</Button></div>
        </div>
      </Modal>

      <Modal open={previewOpen} onClose={()=>setPreviewOpen(false)} title={`${L('core.performance.rawMetricPreview','Raw Metric Preview')} - ${selected?.code || ''}`}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-sm">{L('core.performance.selectEmployee','Employee')}<select className="mt-1 w-full border rounded px-2 py-2" value={previewForm.operationalPersonId} onChange={(e)=>setPreviewForm({...previewForm,operationalPersonId:e.target.value})}><option value="">--</option>{employees.map((e:any)=><option key={e.id} value={e.id}>{e.code} - {e.name}</option>)}</select></label>
            <Input label={L('core.performance.dateFrom','From')} type="date" value={previewForm.dateFrom} onChange={(e:any)=>setPreviewForm({...previewForm,dateFrom:e.target.value})} />
            <Input label={L('core.performance.dateTo','To')} type="date" value={previewForm.dateTo} onChange={(e:any)=>setPreviewForm({...previewForm,dateTo:e.target.value})} />
          </div>
          <Button onClick={runPreview} disabled={previewLoading || !previewForm.operationalPersonId}>{previewLoading?t('common.loading'):L('core.performance.preview','Preview')}</Button>
          {previewResult && (
            <div className="border rounded p-3 text-sm space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div><span className="text-gray-500">{L('common.status','Status')}</span><div className="font-medium">{L(`core.performance.${previewResult.status === 'CALCULABLE' ? 'calculable' : previewResult.status === 'INSUFFICIENT_DATA' ? 'insufficientData' : previewResult.status === 'NOT_APPLICABLE' ? 'notApplicable' : previewResult.status === 'ATTRIBUTION_AMBIGUOUS' ? 'attributionAmbiguous' : previewResult.status === 'SOURCE_UNAVAILABLE' ? 'sourceUnavailable' : 'configMissing'}`, previewResult.status)}</div></div>
                <div><span className="text-gray-500">{L('core.performance.rawValue','Raw Value')}</span><div className="font-medium">{previewResult.rawValue ?? '-'}</div></div>
                <div><span className="text-gray-500">{L('core.performance.numerator','Numerator')}</span><div>{previewResult.numerator ?? '-'}</div></div>
                <div><span className="text-gray-500">{L('core.performance.denominator','Denominator')}</span><div>{previewResult.denominator ?? '-'}</div></div>
              </div>
              <p className="text-gray-700">{previewResult.explanation}</p>
              {previewResult.excluded?.count > 0 && <p className="text-amber-700">{L('core.performance.excludedRecords','Excluded records')}: {previewResult.excluded.count} {JSON.stringify(previewResult.excluded.reasons)}</p>}
              {previewResult.dataQuality?.issues?.length > 0 && <p className="text-amber-700">{L('core.performance.dataQualityIssues','Data Quality Issues')}: {previewResult.dataQuality.issues.join(', ')}</p>}
              <div>
                <div className="font-medium mb-1">{L('core.performance.evidence','Evidence')} ({previewResult.evidenceCount})</div>
                <div className="max-h-48 overflow-auto border rounded">
                  <table className="min-w-full text-xs"><thead><tr className="border-b"><th className="px-2 py-1 text-left">{L('core.performance.evidenceSource','Source')}</th><th className="px-2 py-1 text-left">ID</th><th className="px-2 py-1 text-left">{L('core.performance.evidenceTime','Time')}</th><th className="px-2 py-1 text-left">{L('core.performance.evidenceContribution','Contribution')}</th></tr></thead><tbody>
                    {(previewResult.evidence || []).map((ev:any, idx:number)=>(<tr key={idx} className="border-b"><td className="px-2 py-1">{ev.sourceType}</td><td className="px-2 py-1 font-mono">{ev.sourceNumber || ev.sourceId}</td><td className="px-2 py-1">{ev.occurredAt ? String(ev.occurredAt).slice(0,19).replace('T',' ') : '-'}</td><td className="px-2 py-1">{JSON.stringify(ev.contribution)}</td></tr>))}
                    {(previewResult.evidence||[]).length===0 && <tr><td colSpan={4} className="px-2 py-2 text-gray-500">{L('core.performance.noEvidence','No evidence')}</td></tr>}
                  </tbody></table>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
