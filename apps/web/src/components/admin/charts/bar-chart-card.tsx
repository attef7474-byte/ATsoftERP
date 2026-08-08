'use client';
import React from 'react';
import { chartColor } from './chart-colors';
import { ChartContainer } from './chart-container';
import { ChartEmptyState } from './chart-empty-state';
import { ChartLegend } from './chart-legend';

export interface BarChartDatum {
  label: string;
  value: number;
  color?: string;
}

interface BarChartCardProps {
  data: BarChartDatum[];
  formatValue?: (value: number) => string;
  height?: number;
  ariaLabel?: string;
  emptyMessage?: string;
}

const WIDTH = 640;
const MARGIN = { top: 22, right: 8, bottom: 34, left: 40 };

function truncateLabel(label: string, max = 14): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function BarChartCard({
  data,
  formatValue = (value) => String(value),
  height = 280,
  ariaLabel,
  emptyMessage = 'No data available',
}: BarChartCardProps) {
  const values = data.map((d) => d.value);
  const maxValue = values.length > 0 ? Math.max(...values, 0) : 0;
  const yMax = maxValue > 0 ? maxValue : 1;

  if (data.length === 0) {
    return <ChartEmptyState message={emptyMessage} />;
  }

  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const slot = plotWidth / data.length;
  const barWidth = Math.min(slot * 0.62, 52);
  const gridFractions = [0, 0.25, 0.5, 0.75, 1];
  const labelStep = Math.max(1, Math.ceil(data.length / 12));

  return (
    <div>
      <ChartContainer height={height}>
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="block h-auto w-full"
          role="img"
          aria-label={ariaLabel}
        >
          <title>{ariaLabel}</title>
          {gridFractions.map((fraction) => {
            const y = MARGIN.top + (1 - fraction) * plotHeight;
            return (
              <g key={fraction}>
                <line
                  x1={MARGIN.left}
                  x2={WIDTH - MARGIN.right}
                  y1={y}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeDasharray={fraction === 0 ? undefined : '3 4'}
                />
                <text
                  x={MARGIN.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="#6b7280"
                >
                  {formatValue(fraction * yMax)}
                </text>
              </g>
            );
          })}
          {data.map((datum, index) => {
            const barHeight = (datum.value / yMax) * plotHeight;
            const x = MARGIN.left + index * slot + (slot - barWidth) / 2;
            const y = MARGIN.top + plotHeight - barHeight;
            const showLabel = index % labelStep === 0;
            return (
              <g key={`${datum.label}-${index}`}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={3}
                  fill={datum.color ?? chartColor(index)}
                />
                {datum.value !== 0 && barHeight >= 14 ? (
                  <text
                    x={x + barWidth / 2}
                    y={y - 5}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill="#374151"
                  >
                    {formatValue(datum.value)}
                  </text>
                ) : null}
                {showLabel ? (
                  <text
                    x={x + barWidth / 2}
                    y={height - MARGIN.bottom + 16}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#6b7280"
                  >
                    {truncateLabel(datum.label)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </ChartContainer>
      <ChartLegend
        items={data.map((datum, index) => ({
          label: datum.label,
          color: datum.color ?? chartColor(index),
        }))}
      />
    </div>
  );
}
