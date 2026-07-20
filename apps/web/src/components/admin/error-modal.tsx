'use client';
import React, { createContext, useContext, useState, useCallback } from 'react';
import { useTranslation } from '../../lib/i18n/use-translation';
import { Modal } from './ui';

interface ErrorConfig {
  title?: string;
  message: string;
  detail?: string;
  onRetry?: () => void;
}

interface ErrorModalContextValue {
  showError: (config: ErrorConfig) => void;
  hideError: () => void;
}

const ErrorModalContext = createContext<ErrorModalContextValue>({
  showError: () => {},
  hideError: () => {},
});

export function useErrorModal() {
  return useContext(ErrorModalContext);
}

export function ErrorModalProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ErrorConfig | null>(null);

  const showError = useCallback((cfg: ErrorConfig) => {
    setConfig(cfg);
  }, []);

  const hideError = useCallback(() => {
    setConfig(null);
  }, []);

  return (
    <ErrorModalContext.Provider value={{ showError, hideError }}>
      {children}
      <Modal open={!!config} onClose={hideError} title={config?.title || t('errors.generalError')} size="sm">
        {config && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-gray-700">{config.message}</p>
            </div>
            {config.detail && (
              <pre className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 max-h-32 overflow-auto whitespace-pre-wrap">
                {config.detail}
              </pre>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={hideError} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
                {t('common.close')}
              </button>
              {config.onRetry && (
                <button onClick={() => { hideError(); config.onRetry?.(); }} className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-md hover:bg-red-700">
                  {t('common.retry')}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </ErrorModalContext.Provider>
  );
}
