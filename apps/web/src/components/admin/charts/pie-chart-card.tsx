'use client';
import React from 'react';
import { chartColor } from './chart-colors';
import { ChartEmptyState } from './chart-empty-state';

export interface PieChartDatum {
  label: string;
  value: number;
  color?: string;
}

interface PieChartCardProps {
  data: PieChartDatum[];
  formatValue?: (value: number) => string;
  height?: number;
  centerLabel?: string;
  centerValue?: string;
  ariaLabel?: string;
  emptyMessage?: string;
}

const WIDTH = 640;
const HEIGHT = 280;
const CX = 150;
const CY = 140;
const RADIUS = 92;
const STROKE = 32;
const LEGEND_X = 320;

export function PieChartCard({
  data,
  formatValue = (value) => String(value),
  height = HEIGHT,
  centerLabel,
  centerValue,
  ariaLabel,
  emptyMessage = 'No data available',
}: PieChartCardProps) {
  const total = data.reduce((sum, datum) => sum + Math.max(datum.value, 0), 0);

  if (data.length === 0 || total <= 0) {
    return <ChartEmptyState message={emptyMessage} />;
  }

  const circumference = 2 * Math.PI * RADIUS;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="shrink-0" dir="ltr">
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="block h-auto w-full max-w-[360px]"
          role="img"
          aria-label={ariaLabel}
        >
          <title>{ariaLabel}</title>
          {data.map((datum, index) => {
            const fraction = datum.value / total;
            const dash = Math.max(fraction * circumference - 2, 0.5);
            const circle = (
              <circle
                key={`${datum.label}-${index}`}
                cx={CX}
                cy={CY}
                r={RADIUS}
                fill="none"
                stroke={datum.color ?? chartColor(index)}
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${CX} ${CY})`}
              />
            );
            offset += fraction * circumference;
            return circle;
          })}
          <circle cx={CX} cy={CY} r={RADIUS - STROKE / 2 - 2} fill="#ffffff" />
          {centerValue ? (
            <text
              x={CX}
              y={CY}
              textAnchor="middle"
              fontSize="22"
              fontWeight="700"
              fill="#111827"
            >
              {centerValue}
            </text>
          ) : null}
          {centerLabel ? (
            <text
              x={CX}
              y={CY + (centerValue ? 20 : 0)}
              textAnchor="middle"
              fontSize="11"
              fill="#6b7280"
            >
              {centerLabel}
            </text>
          ) : null}
        </svg>
      </div>
      <div className="w-full space-y-2 sm:max-w-[300px]" dir="ltr">
        {data.map((datum, index) => (
          <div key={`${datum.label}-${index}`} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: datum.color ?? chartColor(index) }}
              />
              <span className="truncate text-gray-700 dark:text-gray-200">{datum.label}</span>
            </div>
            <span className="shrink-0 font-medium text-gray-800 dark:text-gray-100">
              {formatValue(datum.value)}
              <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                ({((datum.value / total) * 100).toFixed(1)}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
