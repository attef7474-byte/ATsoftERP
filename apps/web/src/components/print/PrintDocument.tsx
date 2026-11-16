import React from 'react';
import { printFormatters, printText, type PrintDocumentModel, type PrintField, type PrintSection } from '../../lib/print';

export type PrintTranslate = (key: string) => string;

export function PrintContextBlock({ fields }: { fields: PrintField[] }) {
  const visible = fields.filter(field => field.value != null && field.value !== '');
  if (!visible.length) return null;
  return <dl className="print-fields">{visible.map((field, index) => <div key={index}><dt>{field.label}</dt><dd><bdi dir={field.direction || 'auto'}>{printText(field.value)}</bdi></dd></div>)}</dl>;
}

export function PrintFilterSummary({ fields, t }: { fields: PrintField[]; t: PrintTranslate }) {
  const active = fields.filter(field => field.value != null && field.value !== '');
  return active.length ? <section className="print-filters"><h2>{t('reports.printDocument.filters')}</h2><PrintContextBlock fields={active} /></section> : null;
}

export function PrintSummaryMetrics({ fields }: { fields: PrintField[] }) {
  return fields.length ? <section className="print-summary"><PrintContextBlock fields={fields} /></section> : null;
}

export function PrintHeader({ model, t }: { model: PrintDocumentModel; t: PrintTranslate }) {
  const fmt = printFormatters(model.locale, model.timeZone);
  const context: PrintField[] = [{ label: t('reports.printDocument.company'), value: model.company }];
  if (model.branch) context.push({ label: t('reports.printDocument.branch'), value: model.branch });
  context.push(...model.organization || []);
  if (model.periodStart) context.push({ label: t('reports.dateFrom'), value: fmt.dateOnly(model.periodStart), direction: 'ltr' });
  if (model.periodEnd) context.push({ label: t('reports.dateTo'), value: fmt.dateOnly(model.periodEnd), direction: 'ltr' });
  context.push({ label: t('reports.printDocument.date'), value: fmt.date(model.printedAt), direction: 'ltr' }, { label: t('reports.printDocument.time'), value: fmt.time(model.printedAt), direction: 'ltr' });
  if (model.printedBy) context.push({ label: t('reports.printDocument.by'), value: model.printedBy });
  return <header className="print-header"><p className="print-brand">{t('reports.printDocument.brand')}</p><h1>{model.title}</h1>{model.subtitle && <p>{model.subtitle}</p>}{model.documentNumber && <p className="print-document-number"><bdi>{model.documentNumber}</bdi></p>}<PrintContextBlock fields={context} /><p className="print-scope">{model.scopeLabel}</p></header>;
}

export function PrintEmptyState({ t }: { t: PrintTranslate }) { return <p className="print-empty">{t('reports.printDocument.empty')}</p>; }

export function PrintTable({ section, t }: { section: PrintSection<any>; t: PrintTranslate }) {
  const columns = section.columns.filter(column => !column.screenOnly).slice().sort((a, b) => a.priority - b.priority);
  const width = columns.reduce((sum, column) => sum + column.width, 0);
  if (!columns.length) return null;
  return <section className={section.pageBreakBefore ? 'print-section print-page-break' : 'print-section'}>
    {section.title && <h2>{section.title}</h2>}
    {!section.rows.length ? <PrintEmptyState t={t} /> : <table>
      <colgroup>{columns.map(column => <col key={column.key} style={{ width: `${column.width / width * 100}%` }} />)}</colgroup>
      <thead><tr>{columns.map(column => <th key={column.key} scope="col" style={{ textAlign: column.align }}>{column.label}</th>)}</tr></thead>
      <tbody>{section.rows.map((row, index) => <tr key={index}>{columns.map(column => { const value = column.value(row); return <td key={column.key} style={{ textAlign: column.align }}><bdi dir={column.direction || 'auto'}>{column.format ? column.format(value) : printText(value)}</bdi></td>; })}</tr>)}</tbody>
    </table>}
    {section.totals?.length ? <div className="print-totals"><PrintContextBlock fields={section.totals} /></div> : null}
  </section>;
}

export function PrintFooter({ model, t }: { model: PrintDocumentModel; t: PrintTranslate }) {
  const fmt = printFormatters(model.locale, model.timeZone);
  return <footer className="print-footer"><span>{t('reports.printDocument.brand')}</span><bdi dir="ltr">{fmt.date(model.printedAt)} · {fmt.time(model.printedAt)}</bdi></footer>;
}

export function PrintDocument({ model, t }: { model: PrintDocumentModel; t: PrintTranslate }) {
  return <article className="erp-print-document" lang={model.locale} dir={model.locale === 'ar' ? 'rtl' : 'ltr'} data-mode={model.mode}>
    <PrintHeader model={model} t={t} />
    <main><PrintContextBlock fields={model.metadata || []} />{model.description && <section className="print-description"><h2>{t('common.description')}</h2><p>{model.description}</p></section>}<PrintFilterSummary fields={model.filters || []} t={t} /><PrintSummaryMetrics fields={model.summary || []} />
      {model.sections.map((section, index) => <PrintTable key={index} section={section} t={t} />)}
      {model.notes?.length ? <section className="print-notes"><h2>{t('reports.printDocument.notes')}</h2>{model.notes.map((note, index) => <p key={index}>{note}</p>)}</section> : null}
    </main><PrintFooter model={model} t={t} />
  </article>;
}

export function printDocumentCss(orientation: PrintDocumentModel['orientation']): string {
  return `@page {size:A4 ${orientation};margin:16mm 12mm 22mm;}
  *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Tahoma,sans-serif;font-size:10pt;line-height:1.45}
  .erp-print-document{width:100%;color:#111}.print-header{border-bottom:1.5pt solid #222;padding-bottom:4mm;margin-bottom:4mm;break-inside:avoid}
  .print-brand{font-weight:700;font-size:10pt;margin:0}.print-header h1{font-size:18pt;margin:2mm 0 3mm}.print-header p{margin:1mm 0}
  .print-fields{display:block;margin:2mm 0;font-size:0}.print-fields>div{display:inline-block;width:50%;padding:1mm 0;vertical-align:top;break-inside:avoid;font-size:10pt}.print-fields dt{display:inline;font-weight:700;margin-inline-end:2mm}.print-fields dd{display:inline;margin:0;overflow-wrap:break-word}
  .print-scope{font-size:9pt}.print-description{margin:3mm 0;break-inside:avoid}.print-description p{white-space:pre-wrap;margin:0}.print-filters,.print-summary,.print-totals{border:0.5pt solid #777;padding:2mm 3mm;margin:3mm 0;break-inside:avoid}.print-summary .print-fields{display:table;width:100%;table-layout:fixed}.print-summary .print-fields>div{display:table-cell;width:auto;text-align:center;font-size:9pt;padding:0 1mm}.print-summary dt,.print-summary dd{display:block;margin:0}.print-summary dd{margin-top:1mm;font-weight:700}
  h2{font-size:11pt;margin:3mm 0 2mm;break-after:avoid}table{border-collapse:collapse;width:100%;table-layout:fixed;margin:2mm 0 4mm;font-size:9pt}
  th,td{border:0.5pt solid #777;padding:2mm 1.6mm;vertical-align:top;overflow-wrap:anywhere;white-space:normal}th{font-weight:700;background:#eee;color:#111}
  thead{display:table-header-group}tfoot{display:table-footer-group}tr{break-inside:avoid;page-break-inside:avoid}tbody{break-inside:auto}bdi{unicode-bidi:isolate}
  .print-empty{border:0.5pt solid #777;padding:5mm;text-align:center}.print-page-break{break-before:page}.print-notes{margin-top:4mm}.print-footer{position:fixed;bottom:-14mm;left:0;right:0;display:flex;justify-content:space-between;border-top:0.5pt solid #777;padding-top:2mm;font-size:8pt}
  @media screen{body{padding:12mm}.print-footer{position:static;margin-top:8mm}}`;
}
