'use client';

import type { UserProfile } from '../../../lib/auth';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { F9ShortcutButton } from './f9-shortcut';
import { NotificationButton } from './notification-button';
import { UserMenu } from './user-menu';

interface TopBarProps {
  profile: UserProfile | null;
  isRtl: boolean;
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
  onToggleLanguage: () => void;
  onLogout: () => void;
}

export function TopBar({
  profile,
  isRtl,
  onToggleSidebar,
  onOpenSearch,
  onToggleLanguage,
  onLogout,
}: TopBarProps) {
  const { t } = useTranslation();

  return (
    <header className="admin-topbar">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onToggleSidebar} className="admin-hamburger">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-base font-bold text-gray-800 whitespace-nowrap">
          {t('common.appName')}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <F9ShortcutButton onOpen={onOpenSearch} />
        <NotificationButton />
        <UserMenu
          profile={profile}
          isRtl={isRtl}
          onToggleLanguage={onToggleLanguage}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
}
