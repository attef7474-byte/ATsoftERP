'use client';
export function CmmsStatusBadge({ status }: { status?: string | null }) {
  const s = status || '';
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    INACTIVE: 'bg-gray-100 text-gray-800',
    OPEN: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    PENDING: 'bg-blue-100 text-blue-800',
    DONE: 'bg-green-100 text-green-800',
    active: 'bg-green-100 text-green-800',
    expired: 'bg-red-100 text-red-800',
    notDue: 'bg-blue-100 text-blue-800',
    overdue: 'bg-orange-100 text-orange-800',
  };
  const color = colors[s] || 'bg-gray-100 text-gray-800';
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>{s}</span>;
}
