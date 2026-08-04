export const PRODUCTION_LOSS_EVENT_AUDIT_ENTITY = 'ProductionLossQuantityEvent';

export const PRODUCTION_LOSS_TYPES = ['WASTE', 'SCRAP', 'REWORK_SENT', 'REWORK_RECOVERED'] as const;

export const PRODUCTION_LOSS_PERMISSION_KEYS = {
  read: 'production-loss:read',
  record: 'production-loss:record',
  correct: 'production-loss:correct',
} as const;

export const PRODUCTION_LOSS_EVENT_INCLUDE = {
  productionRun: {
    select: {
      id: true,
      runNumber: true,
      status: true,
      product: { select: { id: true, productCode: true, nameAr: true, nameEn: true } },
    },
  },
  productionOrder: { select: { id: true, orderNumber: true } },
  outputEvent: { select: { id: true, eventType: true, classification: true, quantity: true } },
  productionLine: { select: { id: true, code: true, name: true } },
  machine: { select: { id: true, machineCode: true, name: true } },
  measurementPoint: { select: { id: true, code: true, name: true, role: true, unit: true } },
  reasonRef: { select: { id: true, code: true, nameAr: true, nameEn: true, lossCategory: true } },
  sourceEvent: { select: { id: true, type: true, quantity: true, occurredAt: true } },
  correctsEvent: { select: { id: true, type: true, quantity: true } },
  recordedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;
