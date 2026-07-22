'use client';

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-16">
      <p className="text-red-500 mb-4">{message || 'An error occurred'}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          Try again
        </button>
      )}
    </div>
  );
}
