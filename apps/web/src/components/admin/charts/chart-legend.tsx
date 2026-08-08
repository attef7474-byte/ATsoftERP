'use client';
import React from 'react';

export interface ChartLegendItem {
  label: string;
  color: string;
}

interface ChartLegendProps {
  items: ChartLegendItem[];
}

export function ChartLegend({ items }: ChartLegendProps) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5" dir="ltr">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-xs text-gray-600 dark:text-gray-300">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
