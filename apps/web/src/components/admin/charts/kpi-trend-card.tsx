'use client';
import React from 'react';
import { chartColor } from './chart-colors';

interface KpiTrendCardProps {
  label: string;
  value: string;
  change?: number;
  data?: number[];
  color?: string;
  subtitle?: string;
}

const WIDTH = 120;
const HEIGHT = 36;
const PAD = 3;

function buildTrendPoints(data: number[]): string {
  const values = data.filter((v) => !Number.isNaN(v));
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) || 1;
  return values
    .map((value, index) => {
      const x = PAD + (index / Math.max(values.length - 1, 1)) * (WIDTH - PAD * 2);
      const y = HEIGHT - PAD - ((value - min) / span) * (HEIGHT - PAD * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export function KpiTrendCard({
  label,
  value,
  change,
  data,
  color = chartColor(0),
  subtitle,
}: KpiTrendCardProps) {
  const hasChange = typeof change === 'number' && !Number.isNaN(change);
  const positive = hasChange && (change as number) >= 0;
  const points = buildTrendPoints(data ?? []);

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-50">{value}</p>
        <div className="mt-1 flex items-center gap-2">
          {hasChange ? (
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${
                positive
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
              }`}
              dir="ltr"
            >
              {positive ? '▲' : '▼'} {(change as number).toFixed(1)}%
            </span>
          ) : null}
          {subtitle ? (
            <span className="truncate text-xs text-gray-500 dark:text-gray-400">{subtitle}</span>
          ) : null}
        </div>
      </div>
      {points ? (
        <svg
          width="120"
          height="36"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="shrink-0"
          role="img"
          aria-label={`${label} trend`}
        >
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
    </div>
  );
}
