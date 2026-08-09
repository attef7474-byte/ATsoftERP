'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n/use-translation';
import { useToast } from '../../../../components/admin/toast-provider';
import { useApiErrorHandler } from '../../../../components/admin/error-handler';
import { PageHeader, LoadingState } from '../../../../components/admin/ui';
import { useAppearance, PRESET_PROFILES } from '../../../../components/admin/theme/appearance-provider';
import type { AppearancePreset } from '../../../../components/admin/theme/appearance-provider';

type Tab = 'colors' | 'gradients' | 'presets' | 'typography' | 'preview';

const presetMeta: Array<{ value: AppearancePreset; ar: string; en: string; description: string }> = [
  { value: 'REFERENCE_DEFAULT', ar: 'التصميم الافتراضي', en: 'Reference Default', description: 'Blue / teal bilateral gradient' },
  { value: 'MUTED', ar: 'باهت', en: 'Muted', description: 'Soft low-contrast surfaces' },
  { value: 'MEDIUM', ar: 'متوسط', en: 'Medium', description: 'Balanced gradient intensity' },
  { value: 'CONCENTRATED', ar: 'مركز', en: 'Concentrated', description: 'Focused stronger gradient' },
  { value: 'GLASS', ar: 'زجاجي', en: 'Glass', description: 'Translucent blurred surfaces' },
  { value: 'CALM', ar: 'هادئ', en: 'Calm', description: 'Calm desaturated palette' },
  { value: 'FLAT', ar: 'مسطح', en: 'Flat', description: 'Solid surfaces without gradients' },
];

const label = (ar: string, en: string, isAr: boolean) => (isAr ? ar : en);

export default function AppearanceSettingsPage() {
  const { locale } = useTranslation();
  const { showToast } = useToast();
  const handleApiError = useApiErrorHandler();
  const { draftSettings, loading, saving, updateDraft, save, revert, restoreDefaults } = useAppearance();
  const isAr = locale === 'ar';
  const [tab, setTab] = useState<Tab>('colors');
  const [confirmDefaults, setConfirmDefaults] = useState(false);

  const tabs: Array<{ id: Tab; ar: string; en: string }> = [
    { id: 'colors', ar: 'الألوان', en: 'Colors' },
    { id: 'gradients', ar: 'التدرجات', en: 'Gradients' },
    { id: 'presets', ar: 'القوالب الجاهزة', en: 'Presets' },
    { id: 'typography', ar: 'النصوص والكثافة', en: 'Typography & Density' },
    { id: 'preview', ar: 'المعاينة المباشرة', en: 'Live Preview' },
  ];

  const previewStyle = useMemo(() => ({
    '--studio-primary': draftSettings.primaryColor,
    '--studio-accent': draftSettings.accentColor,
    '--studio-intensity': `${Math.max(15, draftSettings.colorIntensity)}%`,
  } as React.CSSProperties), [draftSettings]);

  if (loading) return <LoadingState />;

  const set = (patch: Record<string, unknown>) => updateDraft(patch as never);
  const saveSettings = async () => {
    try {
      await save();
      showToast(isAr ? 'تم حفظ إعدادات المظهر' : 'Appearance settings saved', 'success');
    } catch (err) {
      handleApiError(err);
    }
  };
  const restore = () => {
    restoreDefaults();
    setConfirmDefaults(false);
    showToast(isAr ? 'تم تحميل الإعدادات الافتراضية في المعاينة. اضغط حفظ لتثبيتها.' : 'Defaults loaded into preview. Press Save to persist them.', 'info');
  };
  const applyPreset = (preset: AppearancePreset) => set({ ...PRESET_PROFILES[preset], preset });

  const cardClass = 'rounded-xl border border-slate-200 p-4';
  const headingClass = 'font-bold text-slate-900';
  const fieldLabelClass = 'text-sm font-semibold text-slate-700';
  const selectClass = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2';
  const rangeClass = 'mt-4 w-full accent-blue-700';

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <PageHeader title={label('استوديو تخصيص المظهر', 'Appearance Studio', isAr)} />
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{label('معاينة مباشرة للمظهر العام', 'Live application appearance', isAr)}</p>
            <p className="mt-1 text-xs text-slate-500">{label('تظهر التغييرات فورًا على التطبيق. الحفظ يرسل الإعدادات إلى الخادم.', 'Changes apply immediately. Save persists them on the server.', isAr)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setConfirmDefaults(true)}>{label('استعادة الإعدادات الافتراضية', 'Restore Defaults', isAr)}</button>
            <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={revert}>{label('إلغاء التغييرات', 'Cancel', isAr)}</button>
            <button type="button" disabled={saving} className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50" onClick={saveSettings}>{saving ? label('جارٍ الحفظ…', 'Saving…', isAr) : label('حفظ الإعدادات', 'Save Settings', isAr)}</button>
          </div>
        </div>
      </div>

      {confirmDefaults && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex flex-wrap items-center justify-between gap-3"><span>{label('هل تريد تحميل التصميم الافتراضي؟ لن يتم الحفظ حتى تضغط حفظ.', 'Load the approved reference defaults? Nothing is saved until you press Save.', isAr)}</span><span className="flex gap-2"><button className="rounded-md bg-amber-700 px-3 py-1.5 font-semibold text-white" onClick={restore}>{label('تأكيد', 'Confirm', isAr)}</button><button className="rounded-md border border-amber-300 px-3 py-1.5" onClick={() => setConfirmDefaults(false)}>{label('إلغاء', 'Cancel', isAr)}</button></span></div></div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.95fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap border-b border-slate-200 bg-slate-50 p-2">
            {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === item.id ? 'bg-blue-700 text-white shadow' : 'text-slate-600 hover:bg-white'}`}>{label(item.ar, item.en, isAr)}</button>)}
          </div>
          <div className="space-y-5 p-5">
            {tab === 'colors' && <div className="grid gap-4 md:grid-cols-2">
              <div className={cardClass}><h2 className={headingClass}>{label('اللون الأساسي', 'Primary Color', isAr)}</h2><div className="mt-3 flex items-center gap-3"><input aria-label={label('اللون الأساسي','Primary Color',isAr)} type="color" value={draftSettings.primaryColor} onChange={(e) => set({ primaryColor: e.target.value })} className="h-12 w-16 cursor-pointer rounded border-0 bg-transparent" /><input value={draftSettings.primaryColor} onChange={(e) => set({ primaryColor: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" /></div></div>
              <div className={cardClass}><h2 className={headingClass}>{label('اللون الثانوي', 'Accent / Secondary Color', isAr)}</h2><div className="mt-3 flex items-center gap-3"><input aria-label={label('اللون الثانوي','Accent / Secondary Color',isAr)} type="color" value={draftSettings.accentColor} onChange={(e) => set({ accentColor: e.target.value })} className="h-12 w-16 cursor-pointer rounded border-0 bg-transparent" /><input value={draftSettings.accentColor} onChange={(e) => set({ accentColor: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" /></div></div>
              <div className={`${cardClass} md:col-span-2`}><div className="flex justify-between"><h2 className={headingClass}>{label('شدة اللون', 'Color Intensity', isAr)}</h2><output className="font-mono text-sm text-slate-600">{draftSettings.colorIntensity}</output></div><input aria-label={label('شدة اللون','Color Intensity',isAr)} type="range" min="0" max="100" value={draftSettings.colorIntensity} onChange={(e) => set({ colorIntensity: Number(e.target.value) })} className={rangeClass} /><div className="flex justify-between text-xs text-slate-500"><span>0</span><span>100</span></div></div>
              <label className={`${fieldLabelClass} ${cardClass}`}>{label('الوضع الليلي', 'Theme Mode', isAr)}<select value={draftSettings.themeMode} onChange={(e) => set({ themeMode: e.target.value })} className={selectClass}><option value="light">{label('فاتح','Light',isAr)}</option><option value="dark">{label('داكن','Dark',isAr)}</option></select></label>
              <label className={`${fieldLabelClass} ${cardClass}`}>{label('خلفية الشريط الجانبي', 'Sidebar Background', isAr)}<select value={draftSettings.sidebarBg} onChange={(e) => set({ sidebarBg: e.target.value })} className={selectClass}><option value="navy">{label('كحلي','Navy',isAr)}</option><option value="slate">{label('رمادي داكن','Slate',isAr)}</option><option value="teal">{label('أخضر مزرق','Teal',isAr)}</option><option value="custom">{label('حسب اللون الأساسي','From Primary',isAr)}</option></select></label>
              <label className={`${fieldLabelClass} ${cardClass}`}>{label('لون التحديد في الشريط', 'Sidebar Accent', isAr)}<select value={draftSettings.sidebarAccent} onChange={(e) => set({ sidebarAccent: e.target.value })} className={selectClass}><option value="teal">{label('تركوازي','Teal',isAr)}</option><option value="blue">{label('أزرق','Blue',isAr)}</option><option value="emerald">{label('زمردي','Emerald',isAr)}</option><option value="violet">{label('بنفسجي','Violet',isAr)}</option></select></label>
            </div>}

            {tab === 'gradients' && <div className="space-y-4"><div className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><div><h2 className={headingClass}>{label('التدرج اللوني', 'Gradient Enabled', isAr)}</h2><p className="text-xs text-slate-500">{label('تفعيل التدرجات على الأسطح الفعلية', 'Apply gradients to real application surfaces', isAr)}</p></div><button type="button" role="switch" aria-checked={draftSettings.gradientEnabled} onClick={() => set({ gradientEnabled: !draftSettings.gradientEnabled })} className={`rounded-full px-4 py-2 text-sm font-bold ${draftSettings.gradientEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{draftSettings.gradientEnabled ? 'ON' : 'OFF'}</button></div><div className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between"><h2 className={headingClass}>{label('قوة التدرج', 'Gradient Strength', isAr)}</h2><output>{draftSettings.gradientStrength ?? 70}</output></div><input type="range" min="0" max="100" value={draftSettings.gradientStrength ?? 70} onChange={(e) => set({ gradientStrength: Number(e.target.value) })} className={rangeClass} /></div><div className="grid gap-4 md:grid-cols-2"><label className={fieldLabelClass}>{label('تركيز التدرج','Gradient Focus',isAr)}<select value={draftSettings.gradientFocus ?? 'BALANCED'} onChange={(e) => set({ gradientFocus: e.target.value })} className={selectClass}><option value="SOFT">{label('باهت','Soft',isAr)}</option><option value="BALANCED">{label('متوسط','Balanced',isAr)}</option><option value="CONCENTRATED">{label('مركز','Concentrated',isAr)}</option></select></label><label className={fieldLabelClass}>{label('اتجاه التدرج','Gradient Direction',isAr)}<select value={draftSettings.gradientDirection ?? 'BILATERAL_CENTER'} onChange={(e) => set({ gradientDirection: e.target.value })} className={selectClass}><option value="BILATERAL_CENTER">{label('قطري مركزي','Bilateral center',isAr)}</option><option value="RIGHT_TO_LEFT">{label('من اليمين إلى اليسار','Right to left',isAr)}</option><option value="LEFT_TO_RIGHT">{label('من اليسار إلى اليمين','Left to right',isAr)}</option><option value="TOP_TO_BOTTOM">{label('من الأعلى إلى الأسفل','Top to bottom',isAr)}</option><option value="BOTTOM_TO_TOP">{label('من الأسفل إلى الأعلى','Bottom to top',isAr)}</option></select></label></div></div>}

            {tab === 'presets' && <div className="grid gap-3 sm:grid-cols-2">{presetMeta.map((preset) => <button type="button" key={preset.value} onClick={() => applyPreset(preset.value)} className={`rounded-xl border p-4 text-start transition hover:-translate-y-0.5 hover:shadow-md ${draftSettings.preset === preset.value ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 bg-white'}`}><div className="flex items-center justify-between"><span className="font-bold text-slate-900">{label(preset.ar, preset.en, isAr)}</span><span className="h-6 w-12 rounded-full" style={{ background: preset.value === 'FLAT' ? draftSettings.primaryColor : `linear-gradient(90deg, ${draftSettings.primaryColor}, ${draftSettings.accentColor})` }} /></div><p className="mt-2 text-xs text-slate-500">{preset.description}</p></button>)}</div>}

            {tab === 'typography' && <div className="grid gap-4 md:grid-cols-2">
              <label className={fieldLabelClass}>{label('حجم الخط','Font Size',isAr)}<select value={draftSettings.fontScale} onChange={(e) => set({ fontScale: e.target.value })} className={selectClass}><option value="small">{label('صغير','Small',isAr)}</option><option value="medium">{label('متوسط','Medium',isAr)}</option><option value="large">{label('كبير','Large',isAr)}</option></select></label>
              <label className={fieldLabelClass}>{label('قوة الظل','Shadow Depth',isAr)}<select value={draftSettings.shadowDepth} onChange={(e) => set({ shadowDepth: e.target.value })} className={selectClass}><option value="light">{label('خفيف','Light',isAr)}</option><option value="medium">{label('متوسط','Medium',isAr)}</option><option value="strong">{label('واضح','Strong',isAr)}</option></select></label>
              <label className={fieldLabelClass}>{label('استدارة الزوايا','Border Radius',isAr)}<select value={draftSettings.radius} onChange={(e) => set({ radius: e.target.value })} className={selectClass}><option value="small">{label('صغير','Small',isAr)}</option><option value="medium">{label('متوسط','Medium',isAr)}</option><option value="large">{label('كبير','Large',isAr)}</option></select></label>
              <label className={fieldLabelClass}>{label('كثافة الشريط الجانبي','Sidebar Density',isAr)}<select value={draftSettings.sidebarDensity} onChange={(e) => set({ sidebarDensity: e.target.value })} className={selectClass}><option value="default">{label('افتراضي','Default',isAr)}</option><option value="compact">{label('مضغوط','Compact',isAr)}</option><option value="comfortable">{label('مريح','Comfortable',isAr)}</option></select></label>
              <label className={fieldLabelClass}>{label('حجم خط الشريط','Sidebar Font Size',isAr)}<select value={draftSettings.sidebarFont} onChange={(e) => set({ sidebarFont: e.target.value })} className={selectClass}><option value="normal">{label('عادي','Normal',isAr)}</option><option value="large">{label('كبير','Large',isAr)}</option></select></label>
              <label className={fieldLabelClass}>{label('كثافة الجداول','Table Density',isAr)}<select value={draftSettings.tableDensity} onChange={(e) => set({ tableDensity: e.target.value })} className={selectClass}><option value="default">{label('افتراضي','Default',isAr)}</option><option value="compact">{label('مضغوط','Compact',isAr)}</option><option value="comfortable">{label('مريح','Comfortable',isAr)}</option></select></label>
              <label className={cardClass}><div className="flex items-center justify-between"><span className={fieldLabelClass}>{label('وضع مضغوط','Compact Mode',isAr)}</span><button type="button" role="switch" aria-checked={draftSettings.compactMode} onClick={() => set({ compactMode: !draftSettings.compactMode })} className={`rounded-full px-4 py-2 text-sm font-bold ${draftSettings.compactMode ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{draftSettings.compactMode ? 'ON' : 'OFF'}</button></div></label>
              <label className={cardClass}><div className="flex items-center justify-between"><span className={fieldLabelClass}>{label('شريط جانبي مطوي افتراضيًا','Collapsed Sidebar by Default',isAr)}</span><button type="button" role="switch" aria-checked={draftSettings.sidebarCollapsed} onClick={() => set({ sidebarCollapsed: !draftSettings.sidebarCollapsed })} className={`rounded-full px-4 py-2 text-sm font-bold ${draftSettings.sidebarCollapsed ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{draftSettings.sidebarCollapsed ? 'ON' : 'OFF'}</button></div></label>
              <label className={cardClass}><div className="flex items-center justify-between"><span className={fieldLabelClass}>{label('شريط الحالة','Status Bar',isAr)}</span><button type="button" role="switch" aria-checked={draftSettings.showStatusBar} onClick={() => set({ showStatusBar: !draftSettings.showStatusBar })} className={`rounded-full px-4 py-2 text-sm font-bold ${draftSettings.showStatusBar ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{draftSettings.showStatusBar ? 'ON' : 'OFF'}</button></div></label>
              <label className={cardClass}><div className="flex items-center justify-between"><span className={fieldLabelClass}>{label('شريط الإجراءات','Action Bar',isAr)}</span><button type="button" role="switch" aria-checked={draftSettings.showActionBar} onClick={() => set({ showActionBar: !draftSettings.showActionBar })} className={`rounded-full px-4 py-2 text-sm font-bold ${draftSettings.showActionBar ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{draftSettings.showActionBar ? 'ON' : 'OFF'}</button></div></label>
              <label className={fieldLabelClass}>{label('شفافية الزجاج','Glass Opacity',isAr)}<input type="range" min="0" max="100" value={Math.round((draftSettings.glassOpacity ?? 0.72) * 100)} onChange={(e) => set({ glassOpacity: Number(e.target.value) / 100 })} className={rangeClass} /></label>
              <label className={fieldLabelClass}>{label('ضبابية الزجاج','Glass Blur',isAr)}<input type="range" min="0" max="48" value={draftSettings.glassBlur ?? 14} onChange={(e) => set({ glassBlur: Number(e.target.value) })} className={rangeClass} /></label>
            </div>}

            {tab === 'preview' && <PreviewPanel isAr={isAr} style={previewStyle} draft={draftSettings} />}
          </div>
        </section>
        <PreviewPanel isAr={isAr} style={previewStyle} draft={draftSettings} compact />
      </div>
    </div>
  );
}

function PreviewPanel({ isAr, style, draft, compact = false }: { isAr: boolean; style: React.CSSProperties; draft: any; compact?: boolean }) {
  return <section data-theme-preview className={`overflow-hidden rounded-2xl border border-slate-200 shadow-sm ${compact ? 'self-start' : ''}`} style={style}>
    <div className="p-4 text-sm font-bold text-white" style={{ background: `linear-gradient(110deg, ${draft.primaryColor}, ${draft.accentColor})` }}>{isAr ? 'معاينة مباشرة' : 'Live Preview'}</div>
    <div className="grid min-h-[420px] grid-cols-[110px_1fr] bg-slate-100" style={{ fontSize: draft.fontScale === 'large' ? '1.1rem' : draft.fontScale === 'small' ? '0.9rem' : '1rem' }}>
      <aside className="p-3 text-white" style={{ background: draft.sidebarBg === 'navy' ? '#062b49' : draft.sidebarBg === 'slate' ? '#0f172a' : draft.sidebarBg === 'teal' ? '#0d3b3a' : draft.primaryColor }}><div className="mb-5 font-bold">ATsoft</div><div className="space-y-2 text-xs"><div className="rounded bg-white/20 p-2">{isAr ? 'الرئيسية' : 'Dashboard'}</div><div className="p-2">{isAr ? 'المخزون' : 'Inventory'}</div><div className="p-2">{isAr ? 'الإعدادات' : 'Settings'}</div></div></aside>
      <main className="space-y-4 p-4"><div className="rounded-xl p-4" style={{ background: draft.gradientEnabled ? `linear-gradient(90deg, ${draft.primaryColor}, ${draft.accentColor})` : draft.primaryColor, color: 'white' }}><div className="text-xs opacity-80">{isAr ? 'عنوان الصفحة' : 'Page header'}</div><div className="text-lg font-bold">{isAr ? 'لوحة المظهر' : 'Appearance dashboard'}</div></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white p-4 shadow"><div className="mb-2 font-bold">{isAr ? 'بطاقة' : 'Card'}</div><div className="h-2 rounded bg-slate-200" /></div><div className="rounded-xl bg-white p-4 shadow"><div className="mb-2 font-bold">{isAr ? 'نموذج' : 'Form'}</div><input className="w-full rounded border border-slate-300 px-2 py-1" placeholder={isAr ? 'إدخال' : 'Input'} /></div></div><div className="rounded-xl bg-white p-3 shadow"><div className="mb-2 rounded p-2 font-bold text-slate-900" style={{ background: `${draft.accentColor}33` }}>{isAr ? 'رأس جدول' : 'Table header'}</div><div className="flex items-center justify-between text-xs"><span>{isAr ? 'حالة نشطة' : 'Active status'}</span><span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">{isAr ? 'نشط' : 'Active'}</span></div></div></main>
    </div>
  </section>;
}
