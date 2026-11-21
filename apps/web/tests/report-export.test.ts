import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';

const { act, create } = require('react-test-renderer');

let mockLocale: 'en' | 'ar' = 'en';
let tree: any;
const mockDownload = jest.fn();
const mockError = jest.fn();
const mockToast = jest.fn();
const mockPrint = jest.fn();
const mockCreateElement = jest.fn();
const mockAppendChild = jest.fn();
const mockAnchorClick = jest.fn();
const mockAnchorRemove = jest.fn();
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();
let mockAnchor: any;

const mockT = (key: string): string => {
  const value = key.split('.').reduce<any>((node, part) => node?.[part], mockLocale === 'ar' ? ar : en);
  if (typeof value !== 'string') throw new Error(`Missing ${key}`);
  return value;
};

jest.mock('../src/lib/i18n/use-translation', () => ({
  useTranslation: () => ({ t: mockT, locale: mockLocale, dir: mockLocale === 'ar' ? 'rtl' : 'ltr' }),
}));
jest.mock('../src/lib/api', () => ({
  api: { get: jest.fn(), download: (...args: any[]) => mockDownload(...args) },
}));
jest.mock('../src/components/admin/error-handler', () => ({ useApiErrorHandler: () => mockError }));
jest.mock('../src/components/admin/toast-provider', () => ({ useToast: () => ({ showToast: mockToast }) }));
jest.mock('../src/components/admin/ui', () => ({
  Button: ({ children, ...props }: any) => React.createElement('button', props, children),
}));

import { ReportExportButton } from '../src/components/reports/ReportExportButton';

const nativeDocument = (global as any).document;
const nativeCreateObjectURL = (global as any).URL?.createObjectURL;
const nativeRevokeObjectURL = (global as any).URL?.revokeObjectURL;

const readWeb = (relative: string) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
const lookup = (dictionary: any, key: string) => key.split('.').reduce<any>((node, part) => node?.[part], dictionary);

async function mount(props: Record<string, any> = {}) {
  await act(async () => {
    tree = create(React.createElement(ReportExportButton, {
      filename: 'test-report',
      headers: ['Header 1', 'Header 2'],
      rows: [{ a: 'one', b: 'two' }],
      mapRow: (row: Record<string, any>) => [row.a, row.b],
      ...props,
    }));
  });
}

async function click(node: any) {
  await act(async () => {
    await node.props.onClick();
  });
}

function buttonByLabel(label: string): any {
  return tree.root.findAllByType('button').find((node: any) => node.props.children === label);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLocale = 'en';
  mockAnchor = { href: '', download: '', click: mockAnchorClick, remove: mockAnchorRemove };
  mockCreateElement.mockReturnValue(mockAnchor);
  mockCreateObjectURL.mockReturnValue('blob:test');
  (global as any).document = { createElement: mockCreateElement, body: { appendChild: mockAppendChild } };
  (global as any).URL.createObjectURL = mockCreateObjectURL;
  (global as any).URL.revokeObjectURL = mockRevokeObjectURL;
});

afterEach(async () => {
  if (tree) {
    await act(async () => tree.unmount());
    tree = null;
  }
  if (nativeDocument === undefined) delete (global as any).document;
  else (global as any).document = nativeDocument;
  if (nativeCreateObjectURL) (global as any).URL.createObjectURL = nativeCreateObjectURL;
  else delete (global as any).URL.createObjectURL;
  if (nativeRevokeObjectURL) (global as any).URL.revokeObjectURL = nativeRevokeObjectURL;
  else delete (global as any).URL.revokeObjectURL;
});

describe('shared report export button', () => {
  it.each(['en', 'ar'] as const)('downloads XLSX from the canonical endpoint with a %s localized filename', async locale => {
    mockLocale = locale;
    mockDownload.mockResolvedValue(new Blob(['xlsx']));
    await mount({ reportEndpoint: 'maintenance/requests' });

    await click(buttonByLabel(mockT('reports.exportXlsx')));

    expect(mockDownload).toHaveBeenCalledWith('/reports/export/excel/maintenance/requests');
    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(mockAnchor.download.startsWith(`${mockT('reports.requestsReport')}_`)).toBe(true);
    expect(mockAnchor.download).toMatch(/_\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(mockAnchor.click).toHaveBeenCalledTimes(1);
    expect(mockAnchorRemove).toHaveBeenCalledTimes(1);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test');
    expect(mockToast).toHaveBeenCalledWith(mockT('reports.exportXlsxDone'), 'success');
    expect(mockError).not.toHaveBeenCalled();
  });

  it('routes XLSX failures through the shared error handler without a success toast', async () => {
    const failure = new Error('xlsx denied');
    mockDownload.mockRejectedValue(failure);
    await mount({ reportEndpoint: 'audit' });

    await click(buttonByLabel(mockT('reports.exportXlsx')));

    expect(mockError).toHaveBeenCalledWith(failure);
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
    expect(mockAnchor.click).not.toHaveBeenCalled();
    expect(buttonByLabel(mockT('reports.exportXlsx')).props.disabled).toBe(false);
  });

  it('prevents duplicate XLSX downloads while a response is pending', async () => {
    let resolveDownload: (value: Blob) => void = () => {};
    mockDownload.mockReturnValue(new Promise<Blob>(resolve => { resolveDownload = resolve; }));
    await mount({ reportEndpoint: 'audit' });
    const xlsxButton = () => buttonByLabel(mockT('reports.exportXlsx'));

    act(() => { xlsxButton().props.onClick(); });
    expect(mockDownload).toHaveBeenCalledTimes(1);
    expect(xlsxButton().props.disabled).toBe(true);

    act(() => { xlsxButton().props.onClick(); });
    expect(mockDownload).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveDownload(new Blob(['xlsx']));
      await Promise.resolve();
    });
    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(xlsxButton().props.disabled).toBe(false);
  });

  it('preserves CSV download and print behavior', async () => {
    mockCreateObjectURL.mockReturnValue('blob:csv');
    await mount({ reportEndpoint: 'audit', onPrint: mockPrint });

    await click(buttonByLabel(mockT('reports.exportCsv')));

    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(mockAnchor.download).toMatch(/^test-report_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(mockAnchor.click).toHaveBeenCalledTimes(1);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:csv');

    await click(buttonByLabel(mockT('reports.exportPdf')));
    expect(mockPrint).toHaveBeenCalledTimes(1);
  });

  it('does not show the XLSX action when no report endpoint is supplied', async () => {
    await mount();

    expect(buttonByLabel(mockT('reports.exportXlsx'))).toBeUndefined();
    expect(buttonByLabel(mockT('reports.exportCsv'))).toBeDefined();
    expect(buttonByLabel(mockT('reports.exportPdf'))).toBeDefined();
  });
});

describe('report export locale keys', () => {
  const enReports = (en as any).reports;
  const arReports = (ar as any).reports;

  it('keeps export action and header keys synchronized in EN and AR', () => {
    expect(Object.keys(enReports.exportHeaders).sort()).toEqual(Object.keys(arReports.exportHeaders).sort());
    for (const key of ['exportXlsx', 'exportXlsxDone']) {
      expect(typeof enReports[key]).toBe('string');
      expect(typeof arReports[key]).toBe('string');
      expect(enReports[key]).not.toBe(key);
      expect(arReports[key]).not.toBe(key);
    }
    for (const key of Object.keys(enReports.exportHeaders)) {
      expect(typeof enReports.exportHeaders[key]).toBe('string');
      expect(typeof arReports.exportHeaders[key]).toBe('string');
      expect(enReports.exportHeaders[key]).not.toBe(key);
      expect(arReports.exportHeaders[key]).not.toBe(key);
    }
  });

  it('provides localized file titles for every canonical XLSX endpoint', () => {
    const titleKeys = [
      'reports.requestsReport', 'reports.downtimeReport', 'reports.costsReport', 'reports.schedulesReport',
      'reports.balancesReport', 'reports.countVarianceReport', 'reports.movementsReport', 'reports.adjustmentsReport',
      'reports.barcodeScansReport', 'reports.assetsReport', 'reports.partsReport', 'reports.partnersReport',
      'reports.attachmentsReport', 'reports.auditTrailReport', 'reports.userActivityReport', 'reports.notificationsReport',
      'reports.machineLogReport', 'reports.partsUsageReport', 'reports.upcomingPreventiveReport',
      'reports.overduePreventiveReport', 'reports.lowStockReport',
    ];
    for (const key of titleKeys) {
      expect(typeof lookup(en, key)).toBe('string');
      expect(typeof lookup(ar, key)).toBe('string');
    }
  });
});

describe('report XLSX wiring', () => {
  const reportPages: Array<[string, string]> = [
    ['admin/reports/maintenance/requests', 'maintenance/requests'],
    ['admin/reports/maintenance/downtime', 'maintenance/downtime'],
    ['admin/reports/maintenance/costs', 'maintenance/costs'],
    ['admin/reports/maintenance/schedules', 'maintenance/schedules'],
    ['admin/reports/inventory/balances', 'inventory/balances'],
    ['admin/reports/inventory/count-variance', 'inventory/count-variance'],
    ['admin/reports/inventory/movements', 'inventory/movements'],
    ['admin/reports/inventory/adjustments', 'inventory/adjustments'],
    ['admin/reports/barcodes/scans', 'barcodes/scans'],
    ['admin/reports/assets', 'assets'],
    ['admin/reports/parts', 'parts'],
    ['admin/reports/partners', 'partners'],
    ['admin/reports/attachments', 'attachments'],
    ['admin/reports/audit', 'audit'],
    ['admin/reports/user-activity', 'user-activity'],
    ['admin/reports/notifications', 'notifications'],
    ['admin/reports/machine-log', 'machine-log'],
    ['admin/reports/parts-usage', 'parts-usage'],
    ['admin/reports/upcoming-preventive', 'upcoming-preventive'],
    ['admin/reports/overdue-preventive', 'overdue-preventive'],
    ['admin/reports/low-stock', 'low-stock'],
  ];

  it('wires all 21 report pages to canonical endpoints with translated headers', () => {
    expect(reportPages).toHaveLength(21);
    for (const [relativePath, endpoint] of reportPages) {
      const source = readWeb(`src/app/${relativePath}/page.tsx`);
      expect(source).toContain(`reportEndpoint="${endpoint}"`);
      expect(source).toContain("t('reports.exportHeaders.");
      expect(source).not.toMatch(/headers=\{\[['"]/);
    }
  });

  it('links the notifications, attachments and machine-log reports from the hub', () => {
    const source = readWeb('src/app/admin/reports/page.tsx');
    expect(source).toContain("{ href: '/admin/reports/notifications', labelKey: 'navigation.notificationsReport' }");
    expect(source).toContain("{ href: '/admin/reports/attachments', labelKey: 'navigation.attachmentsReport' }");
    expect(source).toContain("{ href: '/admin/reports/machine-log', labelKey: 'navigation.machineLogReport' }");
  });
});
