'use client';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import {
  AppearanceSettings,
  AppearancePreset,
  REFERENCE_DEFAULT,
  GRADIENT_DIRECTION_ANGLES,
  SIDEBAR_ACCENT_COLORS,
  SHADOW_DEPTH_VALUES,
  buildGradientCss,
  buildTopbarGradientCss,
  buildRadiusValue,
  buildSidebarPalette,
  mixHex,
  shadeHex,
  normalizeAppearanceSettings,
  buildAppearancePayload,
} from '../../../lib/appearance-theme';

export type { AppearanceSettings, AppearancePreset } from '../../../lib/appearance-theme';
export {
  REFERENCE_DEFAULT,
  GRADIENT_DIRECTION_ANGLES,
  GRADIENT_FOCUS_STOPS,
  SHADOW_DEPTH_VALUES,
  SIDEBAR_BG_PALETTES,
  SIDEBAR_ACCENT_COLORS,
  PRESET_PROFILES,
  hexToRgb,
  mixHex,
  shadeHex,
  effectiveGradientSecond,
  buildGradientCss,
  buildTopbarGradientCss,
  buildRadiusValue,
  buildSidebarPalette,
  normalizeAppearanceSettings,
  buildAppearancePayload,
} from '../../../lib/appearance-theme';

function syncLocalStorageCache(s: AppearanceSettings) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem('sidebar-background-mode', s.sidebarBg);
    localStorage.setItem('sidebar-accent-color', s.sidebarAccent);
    localStorage.setItem('sidebar-density', s.sidebarDensity);
    localStorage.setItem('sidebar-font-size', s.sidebarFont);
  } catch {
    // storage unavailable
  }
}

export function applyAppearance(s: AppearanceSettings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const gradient = buildGradientCss(s);
  const palette = buildSidebarPalette(s);
  const accentColor = SIDEBAR_ACCENT_COLORS[s.sidebarAccent] || SIDEBAR_ACCENT_COLORS.teal;
  const activeNav = mixHex(s.accentColor, s.primaryColor, 1 - Math.max(0, Math.min(100, s.colorIntensity)) / 100);
  const angle = GRADIENT_DIRECTION_ANGLES[s.gradientDirection] || '135deg';

  root.style.setProperty('--ats-primary', s.primaryColor);
  root.style.setProperty('--ats-accent', s.accentColor);
  root.style.setProperty('--ats-active-nav', activeNav);
  root.style.setProperty('--ats-sidebar-gradient', s.gradientEnabled ? `linear-gradient(${angle}, ${palette.secondary} 0%, ${palette.main} 100%)` : palette.main);
  root.style.setProperty('--ats-topbar-gradient', buildTopbarGradientCss(s));
  root.style.setProperty('--ats-form-gradient', s.gradientEnabled ? gradient : '#e9f8ff');
  root.style.setProperty('--ats-form-header-gradient', s.gradientEnabled ? gradient : s.primaryColor);
  root.style.setProperty('--ats-radius', buildRadiusValue(s.radius));
  root.style.setProperty('--ats-shadow', SHADOW_DEPTH_VALUES[s.shadowDepth] || SHADOW_DEPTH_VALUES.medium);
  root.style.setProperty('--ats-glass-opacity', String(s.glassOpacity));
  root.style.setProperty('--ats-glass-blur', `${s.glassBlur}px`);
  root.style.setProperty('--ats-font-scale', s.fontScale === 'large' ? '1.08' : s.fontScale === 'small' ? '.94' : '1');

  root.style.setProperty('--ws-primary', accentColor);
  root.style.setProperty('--ws-primary-strong', shadeHex(accentColor, 0.85));
  root.style.setProperty('--ws-accent', s.accentColor);
  root.style.setProperty('--ws-blue', s.primaryColor);

  root.dataset.themeMode = s.themeMode;
  root.dataset.appearancePreset = s.preset;
  root.dataset.sidebarBg = s.sidebarBg;
  root.dataset.sidebarAccent = s.sidebarAccent;
  root.dataset.sidebarDensity = s.sidebarDensity;
  root.dataset.sidebarFont = s.sidebarFont;
  root.dataset.tableDensity = s.tableDensity;
  root.dataset.compactMode = String(s.compactMode);
  root.dataset.showStatusbar = String(s.showStatusBar);
  root.dataset.showActionbar = String(s.showActionBar);
}

type ContextValue = {
  settings: AppearanceSettings;
  draftSettings: AppearanceSettings;
  loading: boolean;
  saving: boolean;
  updateDraft: (patch: Partial<AppearanceSettings>) => void;
  save: () => Promise<void>;
  revert: () => void;
  restoreDefaults: () => void;
};

const C = createContext<ContextValue | null>(null);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppearanceSettings>(REFERENCE_DEFAULT);
  const [draftSettings, setDraft] = useState<AppearanceSettings>(REFERENCE_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const server = normalizeAppearanceSettings(await api.get<Record<string, unknown>>('/settings/appearance'));
        if (active) {
          setSettings(server);
          setDraft(server);
          applyAppearance(server);
        }
      } catch {
        if (active) applyAppearance(REFERENCE_DEFAULT);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loading) applyAppearance(draftSettings);
  }, [draftSettings, loading]);

  const updateDraft = (patch: Partial<AppearanceSettings>) => setDraft((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = buildAppearancePayload(draftSettings);
      const server = normalizeAppearanceSettings(await api.patch<Record<string, unknown>>('/settings/appearance', payload));
      setSettings(server);
      setDraft(server);
      applyAppearance(server);
      syncLocalStorageCache(server);
    } finally {
      setSaving(false);
    }
  };

  const revert = () => setDraft(settings);
  const restoreDefaults = () => setDraft(REFERENCE_DEFAULT);

  const value = useMemo<ContextValue>(
    () => ({ settings, draftSettings, loading, saving, updateDraft, save, revert, restoreDefaults }),
    [settings, draftSettings, loading, saving],
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useAppearance() {
  const value = useContext(C);
  if (!value) throw new Error('useAppearance must be used inside AppearanceProvider');
  return value;
}
