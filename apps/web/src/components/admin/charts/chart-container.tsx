'use client';
import React from 'react';

interface ChartContainerProps {
  height?: number;
  children: React.ReactNode;
}

/**
 * Responsive SVG chart canvas. Scales the fixed viewBox to the container width
 * while preserving the requested aspect height.
 */
export function ChartContainer({ height = 280, children }: ChartContainerProps) {
  return (
    <div
      className="w-full"
      style={{ position: 'relative', width: '100%' }}
      dir="ltr"
    >
      <svg
        viewBox={`0 0 640 ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full"
        role="img"
      >
        {children}
      </svg>
    </div>
  );
}
