'use client';
import React from 'react';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  POSTED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  COUNTED: 'bg-indigo-100 text-indigo-700',
  VERIFIED: 'bg-emerald-100 text-emerald-700',
};

export function InventoryStatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}>
      {status}
    </span>
  );
}

export function InventoryMovementTypeBadge({ type }: { type: string }) {
  const isIn = type?.includes('_IN') || type === 'IN' || type === 'OPENING' || type === 'PURCHASE_RECEIPT' || type === 'PRODUCTION_RECEIPT' || type === 'TRANSFER_IN' || type === 'ADJUSTMENT_IN' || type === 'COUNT_ADJUSTMENT';
  const colors = isIn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}>
      {type}
    </span>
  );
}

export function QuantityDifferenceBadge({ diff }: { diff: number }) {
  const colors = diff === 0 ? 'bg-gray-100 text-gray-700' : diff > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
  const prefix = diff > 0 ? '+' : '';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}>
      {prefix}{diff}
    </span>
  );
}
