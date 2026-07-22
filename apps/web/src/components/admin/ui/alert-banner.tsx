'use client';

interface AlertBannerProps {
  message: string;
  type?: 'error' | 'warning' | 'info' | 'success';
  onDismiss?: () => void;
}

export function AlertBanner({ message, type = 'info', onDismiss }: AlertBannerProps) {
  const colors: Record<string, string> = {
    error: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    success: 'bg-green-50 border-green-200 text-green-700',
  };
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${colors[type]} mb-4`}>
      <span className="text-sm">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="opacity-60 hover:opacity-100 ml-2">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
