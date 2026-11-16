import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
import { collectPrintRows, printFormatters, printText, type PrintDocumentModel } from '../src/lib/print';
import { PrintDocument, printDocumentCss } from '../src/components/print/PrintDocument';
import { maintenanceRequestsPrintModel } from '../src/components/print/maintenance-requests-print';

const translations = { en, ar };
const translate = (locale: 'ar' | 'en') => (key: string): string => {
  const value = key.split('.').reduce<any>((node, segment) => node?.[segment], translations[locale]);
  if (typeof value !== 'string') throw new Error(`Missing translation: ${locale}:${key}`);
  return value;
};
const row = { id: 'internal-cuid-do-not-print', requestNumber: 'MR-1024', title: 'صيانة ماكينة Packing 10019', machine: { name: 'ماكينة التغليف' }, type: 'CORRECTIVE', priority: 'HIGH', status: 'OPEN', createdAt: '2026-11-10T00:00:00Z', password: 'must-not-print', token: 'must-not-print' };
function model(locale: 'ar' | 'en'): PrintDocumentModel {
  return { ...maintenanceRequestsPrintModel({ rows: [row], cards: [{ label: 'totalRequests', value: 1 }] }, { dateFrom: '2026-11-01', dateTo: '2026-11-10', priority: 'HIGH', machineId: 'private-machine-id' }, { machineId: 'ماكينة التغليف' }, translate(locale), locale), locale, company: 'شركة الاختبار', branch: 'فرع الاختبار', printedBy: 'Print Reviewer', printedAt: new Date('2026-11-10T00:15:22Z'), timeZone: 'Asia/Aden' };
}
describe('unified business print document', () => {
  it.each(['ar', 'en'] as const)('renders %s with real document metadata and only explicit business columns', locale => {
    const html = renderToStaticMarkup(React.createElement(PrintDocument, { model: model(locale), t: translate(locale) }));
    expect(html).toContain(`dir="${locale === 'ar' ? 'rtl' : 'ltr'}"`);
    for (const value of ['MR-1024', 'Packing 10019', 'شركة الاختبار', 'فرع الاختبار', 'Print Reviewer', '03:15:22']) expect(html).toContain(value);
    expect(html).toContain(translate(locale)('reports.requestsReport'));
    expect(html).toContain(translate(locale)('reports.printDocument.filters'));
    expect(html).toContain(translate(locale)('reports.totalRequests'));
    for (const value of ['internal-cuid', 'private-machine-id', 'password', 'must-not-print', 'token', '<button', '<input', '<select', '<nav', 'sidebar', 'reports.printDocument.', 'undefined', 'Invalid Date', 'NaN', 'CSV', 'PDF']) expect(html).not.toContain(value);
    expect(html).toMatch(/<thead>/); expect(html).toMatch(/<tbody>/); expect(html).toMatch(/scope="col"/);
    expect((html.match(/<th /g) || []).length).toBe(7);
  });
  it('omits absent fields and empty filters, preserving zero metrics', () => {
    const m = model('en'); m.branch = undefined; m.printedBy = undefined; m.periodStart = undefined; m.periodEnd = undefined; m.filters = [{ label: 'unused', value: '' }]; m.summary = [{ label: 'Zero', value: 0 }];
    const html = renderToStaticMarkup(React.createElement(PrintDocument, { model: m, t: translate('en') }));
    for (const label of ['Applied filters', 'Printed by', 'From Date', 'To Date', 'Branch', 'unused']) expect(html).not.toContain(label);
    expect(html).toContain('Zero'); expect(html).toContain('>0<');
  });
  it('includes print-only columns, excludes screen-only actions and escapes user text', () => {
    const m = model('en'); m.sections[0].columns.push({ key: 'actions', label: 'Actions', value: () => 'EDIT', align: 'start', priority: 4, width: 1, screenOnly: true }, { key: 'extra', label: 'Business detail', value: () => '<script>alert(1)</script>', align: 'start', priority: 3, width: 1, printOnly: true });
    const html = renderToStaticMarkup(React.createElement(PrintDocument, { model: m, t: translate('en') }));
    expect(html).not.toContain('Actions'); expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;'); expect(html).toContain('Business detail');
  });
  it('supports document metadata, sections, totals, page breaks and professional empty output', () => {
    const m = model('en'); m.mode = 'DOCUMENT'; m.documentNumber = 'DOC-1001'; m.metadata = [{ label: 'Status', value: 'Open' }]; m.sections[0].rows = []; m.sections[0].pageBreakBefore = true; m.sections[0].totals = [{ label: 'Total', value: 0 }];
    const html = renderToStaticMarkup(React.createElement(PrintDocument, { model: m, t: translate('en') }));
    expect(html).toContain('DOC-1001'); expect(html).toContain('No data matches'); expect(html).toContain('print-page-break'); expect(html).toContain('data-mode="DOCUMENT"');
  });
  it('has A4 orientation, repeated headings, wrapping and row pagination rules independent of app CSS', () => {
    const css = printDocumentCss('portrait'); expect(css).toContain('size:A4 portrait'); expect(printDocumentCss('landscape')).toContain('size:A4 landscape');
    for (const rule of ['display:table-header-group', 'break-inside:avoid', 'overflow-wrap:anywhere', 'table-layout:fixed', 'break-before:page']) expect(css).toContain(rule);
  });
  it('formats missing values, quantities, money, percentages, durations and date-only boundaries consistently', () => {
    const fmt = printFormatters('en', 'Asia/Aden');
    for (const value of [null, undefined, '', NaN, Infinity]) expect(printText(value)).toBe('—');
    expect(fmt.date('not-a-date')).toBe('—'); expect(fmt.number('NaN')).toBe('—'); expect(fmt.quantity('1234.5')).toBe('1,234.5'); expect(fmt.duration(90.123)).toBe('90.12'); expect(fmt.percent(0.25)).toBe('25%'); expect(fmt.currency('12.3', 'USD')).toContain('12.30');
    expect(printFormatters('en', 'Pacific/Honolulu').dateOnly('2026-11-01')).toBe('01/11/2026');
    expect(printFormatters('ar', 'Asia/Aden').dateOnly('2026-11-05')).toBe('05/11/2026');
    const arabic = renderToStaticMarkup(React.createElement(PrintDocument, { model: model('ar'), t: translate('ar') }));
    expect(arabic).toContain('<bdi dir="ltr">10/11/2026</bdi>');
    expect(arabic).toContain('<bdi dir="ltr">MR-1024</bdi>');
  });
  it('never substitutes a raw lookup ID for a missing filter label', () => {
    expect(() => maintenanceRequestsPrintModel({ rows: [] }, { machineId: 'private-id' }, {}, translate('en'), 'en')).toThrow('unavailable');
  });
});

describe('bounded all-filtered report collection', () => {
  const page = (number: number, total = 205) => ({ rows: Array.from({ length: Math.min(100, Math.max(0, total - (number - 1) * 100)) }, (_, i) => ({ id: `${number}-${i}` })), page: number, pageSize: 100, total, totalPages: Math.ceil(total / 100) });
  it('reads every filtered page exactly once', async () => {
    const load = jest.fn(async n => page(n)); const assertScope = jest.fn();
    const result = await collectPrintRows(load, assertScope, row => row.id); expect(result.rows).toHaveLength(205); expect(load.mock.calls).toEqual([[1, 100], [2, 100], [3, 100]]); expect(assertScope).toHaveBeenCalledTimes(6);
  });
  it('rejects an over-limit total before fetching a second page', async () => { const load = jest.fn(async () => page(1, 501)); await expect(collectPrintRows(load, () => {})).rejects.toThrow('limitExceeded'); expect(load).toHaveBeenCalledTimes(1); });
  it('propagates authorization/data-load failure without returning partial rows', async () => { const load = jest.fn(async n => { if (n === 2) throw new Error('Forbidden'); return page(n); }); await expect(collectPrintRows(load, () => {})).rejects.toThrow('Forbidden'); });
  it('rejects context changes during a request', async () => { let changed = false; await expect(collectPrintRows(async n => { changed = true; return page(n); }, () => { if (changed) throw new Error('contextChanged'); })).rejects.toThrow('contextChanged'); });
  it.each(['changed-total', 'duplicate', 'short-page', 'wrong-page', 'wrong-size'])('rejects %s without printing a partial dataset', async defect => {
    const load = async (n: number) => { const result = page(n); if (n === 2) { if (defect === 'changed-total') result.total++; if (defect === 'duplicate') result.rows[0].id = '1-0'; if (defect === 'short-page') result.rows.pop(); if (defect === 'wrong-page') result.page = 1; if (defect === 'wrong-size') result.pageSize = 20; } return result; };
    await expect(collectPrintRows(load, () => {}, row => row.id)).rejects.toThrow('dataChanged');
  });
  it('accepts an empty complete dataset and the exact limit', async () => { expect((await collectPrintRows(async n => page(n, 0), () => {})).rows).toEqual([]); expect((await collectPrintRows(async n => page(n, 500), () => {})).rows).toHaveLength(500); });
});
