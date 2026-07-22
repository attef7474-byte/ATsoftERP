export interface BarcodeLabel {
  id: string;
  code: string;
  value: string;
  symbology: string;
  entityType: string;
  entityId: string;
  status: string;
  title?: string | null;
  description?: string | null;
  qrPayload?: string | null;
  humanReadableValue?: string | null;
  labelTemplateCode?: string | null;
  printCount: number;
  lastPrintedAt?: string | null;
  lastScannedAt?: string | null;
  scanCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BarcodeScanEvent {
  id: string;
  labelId?: string | null;
  scannedValue: string;
  symbology?: string | null;
  purpose: string;
  result: string;
  source: string;
  entityType?: string | null;
  entityId?: string | null;
  contextType?: string | null;
  contextId?: string | null;
  message?: string | null;
  scannedAt: string;
  label?: { id: string; code: string; value: string; status: string };
}

export interface BarcodeScanResponse {
  result: string;
  message: string;
  event: { id: string; scannedAt: string };
  label?: { id: string; code: string; value: string; entityType?: string; symbology?: string; status: string; title?: string | null };
  entity?: Record<string, unknown>;
  suggestedActions?: string[];
}

export interface BarcodeLabelTemplate {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  symbology: string;
  entityType?: string | null;
  widthMm?: number | null;
  heightMm?: number | null;
  templateData?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BarcodePrintJob {
  id: string;
  labelId?: string | null;
  templateId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  printerName?: string | null;
  copies: number;
  status: string;
  printedById?: string | null;
  jobType: string;
  note?: string | null;
  requestedAt: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
