'use client';

import { useEffect } from 'react';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { ActionSearchIcon } from '../admin-action-bar';

export function useF9Shortcut(onToggle: () => void) {
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (event.key === 'F9') {
        event.preventDefault();
        onToggle();
        return;
      }
      if ((event.key === 'k' || event.key === 'K') && (event.ctrlKey || event.metaKey) && !isInput) {
        event.preventDefault();
        onToggle();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onToggle]);
}

export function F9ShortcutButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
      title={`${t('common.search')} (F9)`}
    >
      <ActionSearchIcon />
    </button>
  );
}
