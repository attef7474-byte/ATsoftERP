'use client';
import React from 'react';
import { useTranslation } from '../../lib/i18n/use-translation';
import { translateUnit } from '../../lib/i18n/literals';

interface SummaryCard {
  label: string;
  value: number | string;
  unit?: string;
}

interface ReportSummaryCardsProps {
  cards: SummaryCard[];
}

export function ReportSummaryCards({ cards }: ReportSummaryCardsProps) {
  const { t, locale } = useTranslation();
  if (!cards || cards.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {cards.map((card, i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-600 tracking-wide">
            {t(card.label.replace(/^reports\./i, ''), 'reports')}
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
          </p>
          {card.unit && <p className="text-xs text-gray-500">{translateUnit(card.unit, locale)}</p>}
        </div>
      ))}
    </div>
  );
}
