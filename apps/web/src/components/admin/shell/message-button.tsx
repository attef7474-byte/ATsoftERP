'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

interface MessageButtonProps {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  onNavigate: () => void;
}

export function MessageButton({ href, label, icon, active, onNavigate }: MessageButtonProps) {
  return (
    <Link
      href={href}
      className={`flex items-center px-3 py-2.5 text-sm font-bold text-gray-800 uppercase tracking-wider rounded-md transition-colors mb-1 ${
        active ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-100 hover:text-gray-900'
      }`}
      onClick={onNavigate}
    >
      <span className="shrink-0 mr-2.5 text-blue-600">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
