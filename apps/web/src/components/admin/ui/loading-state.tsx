'use client';

export function LoadingState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full" />
      <p className="mt-4 text-gray-500 text-sm">{message || 'Loading...'}</p>
    </div>
  );
}
