'use client';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { PrintDocument, printDocumentCss, type PrintTranslate } from './PrintDocument';
import { PrintPreparationError, type PrintDocumentModel } from '../../lib/print';

let activePrint: HTMLIFrameElement | null = null;

/** Only this isolated business-document frame may call the browser print API. */
export async function openPrintDocument(model: PrintDocumentModel, t: PrintTranslate, assertScope: () => void): Promise<void> {
  if (activePrint) throw new PrintPreparationError('unavailable');
  assertScope();
  const frame = document.createElement('iframe');
  frame.title = model.title;
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1120px;height:800px;border:0;';
  activePrint = frame;
  let root: ReturnType<typeof createRoot> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (expiry) clearTimeout(expiry);
    root?.unmount(); frame.remove();
    if (activePrint === frame) activePrint = null;
  };
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new PrintPreparationError('unavailable')), 10000);
      frame.onload = () => { clearTimeout(timeout); resolve(); };
      frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="print-root"></div></body></html>';
      document.body.appendChild(frame);
    });
    const target = frame.contentWindow, doc = frame.contentDocument;
    if (!target || !doc) throw new PrintPreparationError('unavailable');
    doc.title = model.title;
    doc.documentElement.lang = model.locale;
    doc.documentElement.dir = model.locale === 'ar' ? 'rtl' : 'ltr';
    const style = doc.createElement('style'); style.textContent = printDocumentCss(model.orientation); doc.head.appendChild(style);
    root = createRoot(doc.getElementById('print-root')!);
    flushSync(() => root!.render(<PrintDocument model={{ ...model, printedAt: new Date() }} t={t} />));
    await doc.fonts?.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    assertScope();
    target.addEventListener('afterprint', cleanup, { once: true });
    // afterprint handles both print and cancellation; expiry protects abandoned frames.
    expiry = setTimeout(cleanup, 10 * 60 * 1000);
    target.focus();
    target.print();
  } catch (error) { cleanup(); throw error; }
}
