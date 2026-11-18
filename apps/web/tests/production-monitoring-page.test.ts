import React from 'react';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
const {
  act,
  create
} = require('react-test-renderer');
let mockLocale = 'en',
  mockAllowed = true;
let mockMonitor: any;
const mockRefresh = jest.fn(),
  mockSetAuto = jest.fn();
let mockActions: any[] = [];
const mockT = (key: string): string => {
  const value = key.split('.').reduce<any>((node, part) => node?.[part], mockLocale === 'ar' ? ar : en);
  if (typeof value !== 'string') throw new Error(`Missing translation ${key}`);
  return value;
};
jest.mock('../src/lib/i18n/use-translation', () => ({
  useTranslation: () => ({
    t: mockT,
    locale: mockLocale
  })
}));
jest.mock('../src/lib/auth-context', () => ({
  useAuth: () => ({
    permissions: {
      permissions: mockAllowed ? ['production-analytics:read'] : []
    },
    isSuperAdmin: false,
    loading: false
  }),
  useOperationalContext: () => ({
    contextVersion: 1
  })
}));
jest.mock('../src/lib/use-production-monitoring', () => ({
  useProductionMonitoring: () => mockMonitor
}));
jest.mock('../src/components/admin/admin-action-bar', () => ({
  useRegisterAdminActions: (actions: any[]) => {
    mockActions = actions;
  },
  useStableHandlers: (handlers: any) => ({
    exec: (name: string) => handlers[name]()
  }),
  ActionRefreshIcon: () => null
}));
jest.mock('../src/components/f9/F9Lookup', () => ({
  F9Lookup: (props: any) => React.createElement('lookup', props)
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: any) => React.createElement('a', {
    href,
    ...props
  }, children)
}));
jest.mock('../src/components/admin/ui', () => ({
  Button: ({
    children,
    ...props
  }: any) => React.createElement('button', props, children),
  Input: (props: any) => React.createElement('input', props),
  Select: (props: any) => React.createElement('select', props),
  AlertBanner: ({
    message
  }: any) => React.createElement('aside', {}, message),
  LoadingState: () => React.createElement('progress'),
  ErrorState: ({
    message
  }: any) => React.createElement('aside', {}, message)
}));
import { ProductionMonitoringPanel } from '../src/components/factory/production-monitoring-panel';
const output = [{
  unit: 'PACK',
  quantity: '1000',
  goodQuantity: '950',
  rejectQuantity: '50'
}];
const totals = {
  now: output,
  currentShift: output,
  today: output,
  monthToDate: output
};
const row = (id: string, resourceType: string, classification: string) => ({
  id,
  resourceType,
  code: id,
  name: id,
  classification,
  operationType: {
    id: 'op',
    code: 'PACKAGING',
    name: 'Operation'
  },
  productionLine: resourceType === 'MACHINE' ? {
    id: 'line-b',
    code: 'LB',
    name: 'Line B'
  } : null,
  status: 'RUNNING',
  currentRuns: [{
    id: 'run',
    runNumber: 'RUN-1',
    product: {
      id: 'pa',
      code: 'PA',
      name: 'Product A'
    }
  }],
  totals,
  lastEventAt: '2026-11-19T10:00:00Z'
});
let tree: any;
async function mount() {
  await act(async () => {
    tree = create(React.createElement(ProductionMonitoringPanel));
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  mockLocale = 'en';
  mockAllowed = true;
  mockMonitor = {
    data: {
      timezone: 'UTC',
      generatedAt: '2026-11-19T12:00:00Z',
      windows: {
        currentShift: {
          shiftId: 's',
          shiftCode: 'S1',
          shiftName: 'Shift 1',
          from: '2026-11-19T08:00:00Z',
          to: '2026-11-19T16:00:00Z'
        }
      },
      summary: [{
        classification: 'PACKAGING',
        totals
      }],
      lines: [row('line-a', 'LINE', 'MANUFACTURING'), row('line-b', 'LINE', 'PACKAGING'), row('line-c', 'LINE', 'UNCLASSIFIED')],
      machines: [row('machine-a', 'MACHINE', 'PACKAGING')],
      dataQuality: {
        unassignedToMachine: totals,
        ambiguousShift: false,
        multipleActiveResources: 0,
        inaccessibleMachineRuns: 0
      }
    },
    loading: false,
    error: '',
    autoRefresh: true,
    setAutoRefresh: mockSetAuto,
    refresh: mockRefresh
  };
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null;
});
describe('production monitoring workspace rendering', () => {
  it.each(['en', 'ar'])('renders four windows, every required resource section and translated states in %s', async locale => {
    mockLocale = locale;
    await mount();
    const text = JSON.stringify(tree.toJSON());
    for (const key of ['manufacturingLines', 'packagingLines', 'packagingMachines', 'otherLines', 'currentProduct', 'currentRun', 'now', 'currentShift', 'today', 'monthToDate', 'RUNNING']) expect(text).toContain(mockT('production.monitoring.' + key));
    expect(text).not.toContain('production.monitoring.');
    expect(text).not.toContain('[object Object]');
    expect(text).toContain('PACK');
    expect(text).toContain('PA');
  });
  it('keeps run links hidden without the native run-read permission and provides scoped analytics drilldown', async () => {
    await mount();
    const hrefs = tree.root.findAllByType('a').map((node: any) => node.props.href);
    expect(hrefs.some((href: string) => href.startsWith('/admin/production/runs/'))).toBe(false);
    expect(hrefs).toContain('/admin/production/analytics?tab=analytics&productionLineId=line-a');
    expect(hrefs).toContain('/admin/production/analytics?tab=analytics&machineId=machine-a');
  });
  it('renders only read-only refresh actions and invokes manual refresh', async () => {
    await mount();
    expect(mockActions.every(action => action.readOnly)).toBe(true);
    const refresh = tree.root.findAllByType('button').find((node: any) => node.props.children === en.common.refresh);
    await act(async () => refresh.props.onClick());
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
  it('shows retained data and an explicit stale indicator after a refresh error', async () => {
    mockMonitor.error = 'Retry';
    await mount();
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain(mockT('production.monitoring.stale'));
    expect(text).toContain('RUN-1');
  });
  it('shows no active shift without suppressing day/month output', async () => {
    mockMonitor.data.windows.currentShift = null;
    await mount();
    expect(JSON.stringify(tree.toJSON())).toContain(mockT('production.monitoring.noActiveShift'));
    expect(JSON.stringify(tree.toJSON())).toContain(mockT('production.monitoring.monthToDate'));
  });
  it('denies the page for users lacking production analytics read', async () => {
    mockAllowed = false;
    await mount();
    expect(JSON.stringify(tree.toJSON())).toContain(en.errors.forbidden);
    expect(tree.root.findAllByType('table')).toHaveLength(0);
    expect(mockActions).toEqual([]);
  });
  it('renders an empty factory cleanly', async () => {
    mockMonitor.data.lines = [];
    mockMonitor.data.machines = [];
    mockMonitor.data.summary = [];
    await mount();
    expect(JSON.stringify(tree.toJSON())).toContain(en.common.noData);
  });
});
