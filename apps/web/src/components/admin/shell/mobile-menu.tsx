'use client';

import type { UserProfile } from '../../../lib/auth';
import { useTranslation } from '../../../lib/i18n/use-translation';
import { navItems } from './navigation-data';
import { NavigationItems } from './sidebar';
import { MobileUserSummary } from './user-menu';

export function MobileMenuOverlay({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-[70] bg-black bg-opacity-50" onClick={onClose} />;
}

interface MobileMenuPanelProps {
  isRtl: boolean;
  pathname: string;
  profile: UserProfile | null;
  expandedSections: Record<string, boolean>;
  onToggleSection: (id: string) => void;
  onClose: () => void;
}

export function MobileMenuPanel({
  isRtl,
  pathname,
  profile,
  expandedSections,
  onToggleSection,
  onClose,
}: MobileMenuPanelProps) {
  const { t } = useTranslation();

  return (
    <aside
      className={`fixed inset-y-0 z-[65] w-64 bg-white shadow-xl flex flex-col ${isRtl ? 'right-0' : 'left-0'}`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between h-[56px] px-4 border-b shrink-0">
        <span className="text-base font-bold text-gray-800">{t('common.appName')}</span>
        <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        <NavigationItems
          items={navItems}
          pathname={pathname}
          t={t}
          onNavigate={onClose}
          expandedSections={expandedSections}
          onToggleSection={onToggleSection}
        />
      </nav>
      <div className="border-t px-4 py-3 shrink-0">
        <MobileUserSummary profile={profile} />
      </div>
    </aside>
  );
}
