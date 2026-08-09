export type AppearancePreset = 'REFERENCE_DEFAULT' | 'MUTED' | 'MEDIUM' | 'CONCENTRATED' | 'GLASS' | 'CALM' | 'FLAT';

export interface AppearanceSettings {
  themeMode: string;
  primaryColor: string;
  accentColor: string;
  colorIntensity: number;
  gradientEnabled: boolean;
  gradientStrength: number;
  gradientFocus: string;
  gradientDirection: string;
  preset: AppearancePreset;
  fontScale: string;
  shadowDepth: string;
  radius: string;
  glassOpacity: number;
  glassBlur: number;
  compactMode: boolean;
  sidebarCollapsed: boolean;
  sidebarBg: string;
  sidebarAccent: string;
  sidebarDensity: string;
  sidebarFont: string;
  tableDensity: string;
  showStatusBar: boolean;
  showActionBar: boolean;
}

export const REFERENCE_DEFAULT: AppearanceSettings = {
  themeMode: 'light',
  primaryColor: '#2563eb',
  accentColor: '#14b8a6',
  colorIntensity: 70,
  gradientEnabled: true,
  gradientStrength: 70,
  gradientFocus: 'BALANCED',
  gradientDirection: 'BILATERAL_CENTER',
  preset: 'REFERENCE_DEFAULT',
  fontScale: 'medium',
  shadowDepth: 'medium',
  radius: 'medium',
  glassOpacity: 0.72,
  glassBlur: 14,
  compactMode: false,
  sidebarCollapsed: false,
  sidebarBg: 'navy',
  sidebarAccent: 'teal',
  sidebarDensity: 'default',
  sidebarFont: 'normal',
  tableDensity: 'default',
  showStatusBar: true,
  showActionBar: true,
};

export const GRADIENT_DIRECTION_ANGLES: Record<string, string> = {
  BILATERAL_CENTER: '135deg',
  RIGHT_TO_LEFT: '270deg',
  LEFT_TO_RIGHT: '90deg',
  TOP_TO_BOTTOM: '180deg',
  BOTTOM_TO_TOP: '0deg',
};

export const GRADIENT_FOCUS_STOPS: Record<string, [number, number]> = {
  SOFT: [40, 85],
  BALANCED: [20, 60],
  CONCENTRATED: [0, 35],
};

export const SHADOW_DEPTH_VALUES: Record<string, string> = {
  light: '0 1px 2px rgba(15,23,42,.06)',
  medium: '0 4px 12px rgba(15,23,42,.08)',
  strong: '0 10px 26px rgba(15,23,42,.14)',
};

export const SIDEBAR_BG_PALETTES: Record<string, { main: string; secondary: string }> = {
  navy: { main: '#071A2F', secondary: '#0B2742' },
  slate: { main: '#0F172A', secondary: '#1E293B' },
  teal: { main: '#0D3B3A', secondary: '#134E4A' },
  custom: { main: '#071A2F', secondary: '#0B2742' },
};

export const SIDEBAR_ACCENT_COLORS: Record<string, string> = {
  teal: '#0F766E',
  blue: '#1E40AF',
  emerald: '#065F46',
  violet: '#5B21B6',
};

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3 ? normalized.split('').map((c) => c + c).join('') : normalized;
  const value = parseInt(expanded, 16);
  if (Number.isNaN(value)) return [37, 99, 235];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return '#' + [mix(ar, br), mix(ag, bg), mix(ab, bb)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function shadeHex(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const shade = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return '#' + [shade(r), shade(g), shade(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function effectiveGradientSecond(base: string, accent: string, strength: number): string {
  const t = Math.max(0, Math.min(100, strength)) / 100;
  return mixHex(accent, base, 1 - t);
}

export function buildGradientCss(s: Pick<AppearanceSettings, 'gradientEnabled' | 'gradientDirection' | 'gradientFocus' | 'gradientStrength' | 'primaryColor' | 'accentColor'>): string {
  if (!s.gradientEnabled) return s.primaryColor;
  const angle = GRADIENT_DIRECTION_ANGLES[s.gradientDirection] || '135deg';
  const second = effectiveGradientSecond(s.primaryColor, s.accentColor, s.gradientStrength);
  const [start, end] = GRADIENT_FOCUS_STOPS[s.gradientFocus] || [20, 60];
  return `linear-gradient(${angle}, ${s.primaryColor} 0%, ${s.primaryColor} ${start}%, ${second} ${end}%, ${second} 100%)`;
}

export function buildTopbarGradientCss(s: Pick<AppearanceSettings, 'gradientEnabled' | 'gradientDirection' | 'gradientStrength' | 'primaryColor' | 'accentColor'>): string {
  if (!s.gradientEnabled) return s.primaryColor;
  const angle = GRADIENT_DIRECTION_ANGLES[s.gradientDirection] || '135deg';
  const second = effectiveGradientSecond(s.primaryColor, s.accentColor, s.gradientStrength);
  return `linear-gradient(${angle}, #dff6ff 0%, #dff6ff 30%, ${second} 100%)`;
}

export function buildRadiusValue(radius: string): string {
  return radius === 'large' ? '1rem' : radius === 'small' ? '.375rem' : '.625rem';
}

export function buildSidebarPalette(s: Pick<AppearanceSettings, 'sidebarBg' | 'primaryColor'>): { main: string; secondary: string } {
  if (s.sidebarBg === 'custom') {
    return { main: shadeHex(s.primaryColor, 0.6), secondary: s.primaryColor };
  }
  return SIDEBAR_BG_PALETTES[s.sidebarBg] || SIDEBAR_BG_PALETTES.navy;
}

export const PRESET_PROFILES: Record<AppearancePreset, Partial<AppearanceSettings>> = {
  REFERENCE_DEFAULT: { ...REFERENCE_DEFAULT },
  MUTED: { preset: 'MUTED', gradientStrength: 35, colorIntensity: 35, gradientFocus: 'SOFT' },
  MEDIUM: { preset: 'MEDIUM', gradientStrength: 60, colorIntensity: 55, gradientFocus: 'BALANCED' },
  CONCENTRATED: { preset: 'CONCENTRATED', gradientStrength: 90, colorIntensity: 85, gradientFocus: 'CONCENTRATED' },
  GLASS: { preset: 'GLASS', glassOpacity: 0.55, glassBlur: 22, gradientStrength: 55 },
  CALM: { preset: 'CALM', gradientStrength: 45, colorIntensity: 40, gradientFocus: 'SOFT' },
  FLAT: { preset: 'FLAT', gradientEnabled: false, gradientStrength: 0 },
};

export function normalizeAppearanceSettings(r: Record<string, unknown> | null | undefined): AppearanceSettings {
  const source = r || {};
  const num = (v: unknown, fallback: number) => {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const bool = (v: unknown, fallback: boolean) => (v === undefined ? fallback : v === true || v === 'true');
  const shadowDepth = (source.shadowDepth as string) || (source.shadow as string) || REFERENCE_DEFAULT.shadowDepth;
  return {
    themeMode: (source.themeMode as string) || REFERENCE_DEFAULT.themeMode,
    primaryColor: (source.primaryColor as string) || REFERENCE_DEFAULT.primaryColor,
    accentColor: (source.accentColor as string) || REFERENCE_DEFAULT.accentColor,
    colorIntensity: num(source.colorIntensity, REFERENCE_DEFAULT.colorIntensity),
    gradientEnabled: bool(source.gradientEnabled, REFERENCE_DEFAULT.gradientEnabled),
    gradientStrength: num(source.gradientStrength, REFERENCE_DEFAULT.gradientStrength),
    gradientFocus: (source.gradientFocus as string) || REFERENCE_DEFAULT.gradientFocus,
    gradientDirection: (source.gradientDirection as string) || REFERENCE_DEFAULT.gradientDirection,
    preset: (source.preset as AppearancePreset) || REFERENCE_DEFAULT.preset,
    fontScale: (source.fontScale as string) || REFERENCE_DEFAULT.fontScale,
    shadowDepth,
    radius: (source.radius as string) || REFERENCE_DEFAULT.radius,
    glassOpacity: num(source.glassOpacity, REFERENCE_DEFAULT.glassOpacity),
    glassBlur: num(source.glassBlur, REFERENCE_DEFAULT.glassBlur),
    compactMode: bool(source.compactMode, REFERENCE_DEFAULT.compactMode),
    sidebarCollapsed: bool(source.sidebarCollapsed, REFERENCE_DEFAULT.sidebarCollapsed),
    sidebarBg: (source.sidebarBg as string) || REFERENCE_DEFAULT.sidebarBg,
    sidebarAccent: (source.sidebarAccent as string) || REFERENCE_DEFAULT.sidebarAccent,
    sidebarDensity: (source.sidebarDensity as string) || REFERENCE_DEFAULT.sidebarDensity,
    sidebarFont: (source.sidebarFont as string) || REFERENCE_DEFAULT.sidebarFont,
    tableDensity: (source.tableDensity as string) || REFERENCE_DEFAULT.tableDensity,
    showStatusBar: bool(source.showStatusBar, REFERENCE_DEFAULT.showStatusBar),
    showActionBar: bool(source.showActionBar, REFERENCE_DEFAULT.showActionBar),
  };
}

export function buildAppearancePayload(s: AppearanceSettings): Record<string, unknown> {
  return {
    themeMode: s.themeMode,
    primaryColor: s.primaryColor,
    accentColor: s.accentColor,
    colorIntensity: s.colorIntensity,
    gradientEnabled: s.gradientEnabled,
    gradientStrength: s.gradientStrength,
    gradientFocus: s.gradientFocus,
    gradientDirection: s.gradientDirection,
    preset: s.preset,
    fontScale: s.fontScale,
    shadowDepth: s.shadowDepth,
    radius: s.radius,
    glassOpacity: s.glassOpacity,
    glassBlur: s.glassBlur,
    compactMode: s.compactMode,
    sidebarCollapsed: s.sidebarCollapsed,
    sidebarBg: s.sidebarBg,
    sidebarAccent: s.sidebarAccent,
    sidebarDensity: s.sidebarDensity,
    sidebarFont: s.sidebarFont,
    tableDensity: s.tableDensity,
    showStatusBar: s.showStatusBar,
    showActionBar: s.showActionBar,
  };
}
