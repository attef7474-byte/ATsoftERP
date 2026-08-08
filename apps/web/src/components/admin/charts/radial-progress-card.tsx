'use client';
import React from 'react';

interface RadialProgressCardProps {
  value: number;
  label?: string;
  suffix?: string;
  color?: string;
  size?: number;
  strokeWidth?: number;
  formatValue?: (value: number) => string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function RadialProgressCard({
  value,
  label,
  suffix,
  color = '#2563eb',
  size = 170,
  strokeWidth = 14,
  formatValue = (v) => v.toFixed(1),
}: RadialProgressCardProps) {
  const percent = clamp(value, 0, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const dash = (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1" dir="ltr">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
        <text
          x={center}
          y={center + 6}
          textAnchor="middle"
          fontSize={size / 7}
          fontWeight="700"
          fill="#111827"
        >
          {formatValue(percent)}
          {suffix ? <tspan fontSize={size / 12}>{suffix}</tspan> : null}
        </text>
      </svg>
      {label ? (
        <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</p>
      ) : null}
    </div>
  );
}
