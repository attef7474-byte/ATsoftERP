'use client';
import React from 'react';
import { useTranslation } from '../../lib/i18n/use-translation';

interface SummaryCard {
  label: string;
  value: number | string;
  unit?: string;
}

interface ReportSummaryCardsProps {
  cards: SummaryCard[];
}

export function ReportSummaryCards({ cards }: ReportSummaryCardsProps) {
  const { t } = useTranslation();
  if (!cards || cards.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {cards.map((card, i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t(`reports.${card.label}`, 'reports')}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
          </p>
          {card.unit && <p className="text-xs text-gray-400">{card.unit}</p>}
        </div>
      ))}
    </div>
  );
}
