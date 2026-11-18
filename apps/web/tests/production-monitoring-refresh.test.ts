import React from 'react';
import en from '../src/lib/i18n/locales/en';
import ar from '../src/lib/i18n/locales/ar';
const {
  act,
  create
} = require('react-test-renderer');
const mockGet = jest.fn();
let mockLocale = 'en';
const mockT = (key: string) => {
  const value = key.split('.').reduce<any>((current, part) => current?.[part], mockLocale === 'ar' ? ar : en);
  if (typeof value !== 'string') throw new Error(`Missing translation ${key}`);
  return value;
};
jest.mock('../src/lib/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args)
  }
}));
jest.mock('../src/lib/i18n/use-translation', () => ({
  useTranslation: () => ({
    t: mockT,
    locale: mockLocale
  })
}));
import { useProductionMonitoring, MONITORING_REFRESH_MS } from '../src/lib/use-production-monitoring';
import { formatMonitoringQuantity } from '../src/lib/production-monitoring';
let state: ReturnType<typeof useProductionMonitoring>;
let tree: any;
let hidden = false;
let listeners = new Set<() => void>();
const originalDocument = globalThis.document;
function Harness({
  allowed = true,
  contextVersion = 1
}: any) {
  state = useProductionMonitoring(allowed, contextVersion);
  return null;
}
const response = (generatedAt = '2026-11-19T12:00:00Z') => ({
  data: {
    generatedAt
  }
});
async function mount(props: any = {}) {
  await act(async () => {
    tree = create(React.createElement(Harness, props));
  });
}
async function advance(milliseconds = MONITORING_REFRESH_MS) {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds);
  });
}
async function visibility(value: boolean) {
  hidden = value;
  await act(async () => {
    listeners.forEach(listener => listener());
  });
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  hidden = false;
  listeners = new Set();
  mockLocale = 'en';
  (globalThis as any).document = {
    get hidden() {
      return hidden;
    },
    addEventListener: (_name: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_name: string, listener: () => void) => listeners.delete(listener)
  };
  mockGet.mockResolvedValue(response());
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null;
  (globalThis as any).document = originalDocument;
  jest.useRealTimers();
});
describe('production monitoring refresh lifecycle', () => {
  it('fetches immediately and automatically every five seconds', async () => {
    await mount();
    expect(mockGet).toHaveBeenCalledTimes(1);
    await advance();
    expect(mockGet).toHaveBeenCalledTimes(2);
    await advance();
    expect(mockGet).toHaveBeenCalledTimes(3);
    expect(mockGet.mock.calls[0][0]).toBe('/reports/production/monitoring');
  });
  it('does not overlap requests while an earlier response is pending', async () => {
    let resolve: any;
    mockGet.mockReturnValue(new Promise(done => {
      resolve = done;
    }));
    await mount();
    await advance(50000);
    expect(mockGet).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve(response());
    });
    await advance();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
  it('refreshes immediately through the manual refresh action', async () => {
    await mount();
    await act(async () => {
      await state.refresh();
    });
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
  it('pauses while hidden and refreshes immediately on becoming visible', async () => {
    await mount();
    await visibility(true);
    await advance(30000);
    expect(mockGet).toHaveBeenCalledTimes(1);
    await visibility(false);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
  it('aborts a hidden request and rejects its late response after a visible refresh', async () => {
    let oldResolve: any;
    mockGet.mockReturnValueOnce(new Promise(resolve => {
      oldResolve = resolve;
    })).mockResolvedValueOnce(response('new'));
    await mount();
    const signal = mockGet.mock.calls[0][1].signal;
    await visibility(true);
    expect(signal.aborted).toBe(true);
    await visibility(false);
    expect(state.data?.generatedAt).toBe('new');
    await act(async () => {
      oldResolve(response('old'));
    });
    expect(state.data?.generatedAt).toBe('new');
  });
  it('clears old tenant data and rejects late context responses', async () => {
    let oldResolve: any;
    mockGet.mockReturnValueOnce(new Promise(resolve => {
      oldResolve = resolve;
    })).mockResolvedValueOnce(response('context-b'));
    await mount();
    await act(async () => {
      tree.update(React.createElement(Harness, {
        contextVersion: 2
      }));
    });
    expect(mockGet.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => {
      oldResolve(response('context-a'));
    });
    expect(state.data?.generatedAt).toBe('context-b');
  });
  it('retains the last successful output after a failed refresh and clears the error after recovery', async () => {
    await mount();
    mockGet.mockRejectedValueOnce(new Error('temporary'));
    await advance();
    expect(state.data?.generatedAt).toBe('2026-11-19T12:00:00Z');
    expect(state.error).toBe(mockT('production.monitoring.refreshFailed'));
    await advance();
    expect(state.error).toBe('');
  });
  it('lets the operator stop polling while retaining the visible result', async () => {
    await mount();
    await act(async () => {
      state.setAutoRefresh(false);
    });
    const count = mockGet.mock.calls.length;
    await advance(30000);
    expect(mockGet).toHaveBeenCalledTimes(count);
    expect(state.data).not.toBeNull();
  });
  it('never fetches without permission', async () => {
    await mount({
      allowed: false
    });
    await advance(30000);
    expect(mockGet).not.toHaveBeenCalled();
  });
  it('cancels pending work and all polling listeners when unmounted', async () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    await mount();
    const signal = mockGet.mock.calls[0][1].signal;
    await act(async () => tree.unmount());
    tree = null;
    expect(signal.aborted).toBe(true);
    expect(listeners.size).toBe(0);
    await advance(30000);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
  it.each(['en', 'ar'])('retains precise decimal quantities in %s', locale => {
    const value = formatMonitoringQuantity('99999999999999.9999', locale);
    const normalized = value.replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[,٬]/g, '').replace('٫', '.');
    expect(normalized).toBe('99999999999999.9999');
  });
});
