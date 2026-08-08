export const PRODUCTION_FG_RECEIPT_AUDIT_ENTITY = 'ProductionFinishedGoodsReceipt';

export const PRODUCTION_FG_RECEIPT_PERMISSION_KEYS = {
  create: 'production-finished-goods-receipt:create',
  read: 'production-finished-goods-receipt:read',
  update: 'production-finished-goods-receipt:update',
  delete: 'production-finished-goods-receipt:delete',
  post: 'production-finished-goods-receipt:post',
  cancel: 'production-finished-goods-receipt:cancel',
  reverse: 'production-finished-goods-receipt:reverse',
} as const;

export const PRODUCTION_FG_RECEIPT_INCLUDE = {
  productionOrder: { select: { id: true, orderNumber: true, status: true } },
  productionRun: {
    select: {
      id: true,
      runNumber: true,
      status: true,
      startedAt: true,
      endedAt: true,
    },
  },
  receiptWarehouse: { select: { id: true, code: true, name: true } },
  movement: { select: { id: true, movementNumber: true, movementType: true, status: true } },
  lines: {
    include: {
      product: { select: { id: true, code: true, name: true } },
      warehouseLocation: { select: { id: true, code: true, name: true } },
    },
  },
  createdBy: { select: { id: true, name: true } },
  postedBy: { select: { id: true, name: true } },
  cancelledBy: { select: { id: true, name: true } },
} as const;
