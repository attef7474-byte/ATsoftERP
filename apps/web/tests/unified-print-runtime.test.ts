import React from 'react';
import { openPrintDocument } from '../src/components/print/print-runtime';
import type { PrintDocumentModel } from '../src/lib/print';

const mockRender = jest.fn(), mockUnmount = jest.fn();
jest.mock('react-dom/client', () => ({ createRoot: () => ({ render: mockRender, unmount: mockUnmount }) }));
jest.mock('react-dom', () => ({ flushSync: (render: () => void) => render() }));

describe('isolated print frame lifecycle', () => {
  const originals = { document: global.document, requestAnimationFrame: global.requestAnimationFrame };
  const base: PrintDocumentModel = { mode: 'REPORT', title: 'Business report', company: 'Company', locale: 'ar', printedAt: new Date(0), timeZone: 'Asia/Aden', orientation: 'portrait', paperSize: 'A4', sections: [], scopeLabel: 'All filtered results' };
  let frame: any, target: any, doc: any, afterPrint: () => void;
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks(); afterPrint = () => {};
    target = { print: jest.fn(), focus: jest.fn(), addEventListener: jest.fn((event, fn) => { if (event === 'afterprint') afterPrint = fn; }) };
    doc = { title: '', documentElement: {}, createElement: () => ({}), head: { appendChild: jest.fn() }, getElementById: () => ({}), fonts: { ready: Promise.resolve() } };
    frame = { contentWindow: target, contentDocument: doc, style: {}, setAttribute: jest.fn(), remove: jest.fn(), onload: () => {} };
    Object.assign(globalThis, { document: { createElement: (tag: string) => { expect(tag).toBe('iframe'); return frame; }, body: { appendChild: jest.fn(() => { frame.onload(); }) } }, requestAnimationFrame: (fn: FrameRequestCallback) => { fn(0); return 1; } });
  });
  afterEach(() => { afterPrint(); jest.runOnlyPendingTimers(); jest.useRealTimers(); Object.assign(globalThis, originals); });
  it('renders a dedicated model with current runtime timestamp and prints only its frame', async () => {
    jest.setSystemTime(new Date('2026-11-10T12:34:56Z'));
    const assert = jest.fn(); await openPrintDocument(base, key => key, assert);
    expect(target.print).toHaveBeenCalledTimes(1); expect(doc.documentElement).toEqual({ lang: 'ar', dir: 'rtl' });
    const node: React.ReactElement<any> = mockRender.mock.calls[0][0]; expect(node.props.model.printedAt.toISOString()).toBe('2026-11-10T12:34:56.000Z'); expect(node.props.model.printedAt).not.toEqual(base.printedAt);
    expect(frame.setAttribute).toHaveBeenCalledWith('sandbox', 'allow-same-origin allow-modals'); expect(assert).toHaveBeenCalledTimes(2);
    expect(mockUnmount).not.toHaveBeenCalled(); afterPrint(); afterPrint(); expect(mockUnmount).toHaveBeenCalledTimes(1); expect(frame.remove).toHaveBeenCalledTimes(1);
  });
  it('waits for fonts and a rendered layout before opening print', async () => {
    let ready!: () => void; doc.fonts.ready = new Promise<void>(resolve => { ready = resolve; });
    const pending = openPrintDocument(base, key => key, () => {}); await Promise.resolve(); expect(target.print).not.toHaveBeenCalled(); ready(); await pending; expect(target.print).toHaveBeenCalledTimes(1);
  });
  it('denies a duplicate frame while a print preview is still open', async () => {
    await openPrintDocument(base, key => key, () => {}); await expect(openPrintDocument(base, key => key, () => {})).rejects.toThrow('unavailable'); expect(target.print).toHaveBeenCalledTimes(1);
  });
  it('cleans up and does not print when context changes during rendering', async () => {
    let count = 0; await expect(openPrintDocument(base, key => key, () => { if (++count === 2) throw new Error('contextChanged'); })).rejects.toThrow('contextChanged');
    expect(target.print).not.toHaveBeenCalled(); expect(mockUnmount).toHaveBeenCalledTimes(1); expect(frame.remove).toHaveBeenCalledTimes(1);
  });
  it('cleans up a failed print attempt and permits retry', async () => {
    target.print.mockImplementationOnce(() => { throw new Error('print denied'); });
    await expect(openPrintDocument(base, key => key, () => {})).rejects.toThrow('print denied'); expect(frame.remove).toHaveBeenCalledTimes(1);
    await openPrintDocument({ ...base, locale: 'en' }, key => key, () => {}); expect(doc.documentElement.dir).toBe('ltr'); expect(target.print).toHaveBeenCalledTimes(2);
  });
});
