'use client';
import React from 'react';
import { chartColor } from './chart-colors';
import { ChartContainer } from './chart-container';
import { ChartEmptyState } from './chart-empty-state';
import { ChartLegend } from './chart-legend';

export interface LineChartDatum {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface LineChartCardProps {
  data: LineChartDatum[];
  formatValue?: (value: number) => string;
  height?: number;
  seriesName?: string;
  secondarySeriesName?: string;
  ariaLabel?: string;
  emptyMessage?: string;
}

const WIDTH = 640;
const MARGIN = { top: 18, right: 12, bottom: 34, left: 44 };

function truncateLabel(label: string, max = 14): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function computeDomain(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  if (rawMax === rawMin) {
    const pad = Math.max(1, Math.abs(rawMax) * 0.1);
    return { min: rawMin - pad, max: rawMax + pad };
  }
  const pad = (rawMax - rawMin) * 0.1;
  return { min: rawMin - pad, max: rawMax + pad };
}

function buildPoints(
  data: LineChartDatum[],
  accessor: (d: LineChartDatum) => number | undefined,
  min: number,
  max: number,
  plotWidth: number,
  plotHeight: number,
): string {
  return data
    .map((datum, index) => {
      const value = accessor(datum);
      if (value === undefined || value === null || Number.isNaN(value)) return null;
      const x = MARGIN.left + (index / Math.max(data.length - 1, 1)) * plotWidth;
      const y = MARGIN.top + (1 - (value - min) / (max - min)) * plotHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(' ');
}

export function LineChartCard({
  data,
  formatValue = (value) => String(value),
  height = 280,
  seriesName = 'Series',
  secondarySeriesName = 'Series 2',
  ariaLabel,
  emptyMessage = 'No data available',
}: LineChartCardProps) {
  const primaryValues = data.map((d) => d.value).filter((v) => !Number.isNaN(v));
  const secondaryValues = data
    .map((d) => d.secondaryValue)
    .filter((v): v is number => v !== undefined && !Number.isNaN(v));

  if (data.length === 0 || primaryValues.length === 0) {
    return <ChartEmptyState message={emptyMessage} />;
  }

  const { min, max } = computeDomain([...primaryValues, ...secondaryValues]);
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const gridFractions = [0, 0.25, 0.5, 0.75, 1];
  const labelStep = Math.max(1, Math.ceil(data.length / 12));
  const showSecondary = secondaryValues.length > 0;

  const primaryLine = buildPoints(data, (d) => d.value, min, max, plotWidth, plotHeight);
  const secondaryLine = buildPoints(
    data,
    (d) => d.secondaryValue,
    min,
    max,
    plotWidth,
    plotHeight,
  );
  const primaryArea = `${MARGIN.left},${MARGIN.top + plotHeight} ${primaryLine} ${WIDTH - MARGIN.right},${MARGIN.top + plotHeight}`;

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
                  {formatValue(min + fraction * (max - min))}
                </text>
              </g>
            );
          })}
          <polygon points={primaryArea} fill={chartColor(0)} opacity="0.12" />
          <polyline
            points={primaryLine}
            fill="none"
            stroke={chartColor(0)}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {showSecondary ? (
            <>
              <polygon points={primaryArea} fill="none" />
              <polyline
                points={secondaryLine}
                fill="none"
                stroke={chartColor(1)}
                strokeWidth="2"
                strokeDasharray="5 4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          ) : null}
          {data.map((datum, index) => {
            const x = MARGIN.left + (index / Math.max(data.length - 1, 1)) * plotWidth;
            const y = MARGIN.top + (1 - (datum.value - min) / (max - min)) * plotHeight;
            const showLabel = index % labelStep === 0;
            return (
              <g key={`${datum.label}-${index}`}>
                <circle cx={x} cy={y} r="3" fill={chartColor(0)} stroke="#ffffff" strokeWidth="1" />
                {showLabel ? (
                  <text
                    x={x}
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
        items={[
          { label: seriesName, color: chartColor(0) },
          ...(showSecondary ? [{ label: secondarySeriesName, color: chartColor(1) }] : []),
        ]}
      />
    </div>
  );
}
