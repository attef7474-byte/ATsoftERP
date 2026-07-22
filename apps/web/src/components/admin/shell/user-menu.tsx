'use client';

import Link from 'next/link';
import type { UserProfile } from '../../../lib/auth';
import { useTranslation } from '../../../lib/i18n/use-translation';

interface UserMenuProps {
  profile: UserProfile | null;
  isRtl: boolean;
  onToggleLanguage: () => void;
  onLogout: () => void;
}

export function UserMenu({ profile, isRtl, onToggleLanguage, onLogout }: UserMenuProps) {
  const { t } = useTranslation();

  return (
    <>
      <button type="button" onClick={onToggleLanguage} className="px-2.5 py-1 text-xs border rounded-md hover:bg-gray-50 transition-colors whitespace-nowrap">
        {isRtl ? 'English' : '\u0627\u0644\u0639\u0631\u0628\u064a\u0629'}
      </button>
      <Link href="/admin/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium shrink-0">
          {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div className="hidden sm:block leading-tight">
          <p className="text-sm font-medium text-gray-700 truncate max-w-[120px]">{profile?.name || t('common.loading')}</p>
          <p className="text-xs text-gray-500 truncate max-w-[120px]">{profile?.email || t('common.user')}</p>
        </div>
      </Link>
      <button type="button" onClick={onLogout} className="px-2.5 py-1 text-xs text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors whitespace-nowrap">
        {t('common.logout')}
      </button>
    </>
  );
}

export function MobileUserSummary({ profile }: { profile: UserProfile | null }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium shrink-0">
        {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-sm font-medium text-gray-700 truncate">{profile?.name || t('common.loading')}</p>
        <p className="text-xs text-gray-500 truncate">{profile?.email || ''}</p>
      </div>
    </div>
  );
}
