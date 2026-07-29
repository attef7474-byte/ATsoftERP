'use client';
import { useTranslation } from '../../../lib/i18n/use-translation';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
      <div className="text-sm text-gray-600">{t('common.total')} {total}</div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('common.previous')}
        </button>
        <span className="text-sm text-gray-700">
          {t('common.page')} {page} {t('common.of')} {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('common.next')}
        </button>
      </div>
    </div>
  );
}
