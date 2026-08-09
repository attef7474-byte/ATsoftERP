import {
  REFERENCE_DEFAULT,
  normalizeAppearanceSettings,
  buildAppearancePayload,
  buildGradientCss,
  effectiveGradientSecond,
  mixHex,
  shadeHex,
  buildRadiusValue,
  buildSidebarPalette,
  PRESET_PROFILES,
  SHADOW_DEPTH_VALUES,
  SIDEBAR_BG_PALETTES,
} from '../src/lib/appearance-theme';

describe('normalizeAppearanceSettings', () => {
  it('converts server string values into typed numbers and booleans', () => {
    const result = normalizeAppearanceSettings({
      colorIntensity: '25',
      gradientStrength: '40',
      glassOpacity: '0.5',
      glassBlur: '9',
      gradientEnabled: 'false',
      compactMode: 'true',
      showStatusBar: 'false',
      showActionBar: 'true',
    });
    expect(result.colorIntensity).toBe(25);
    expect(result.gradientStrength).toBe(40);
    expect(result.glassOpacity).toBe(0.5);
    expect(result.glassBlur).toBe(9);
    expect(result.gradientEnabled).toBe(false);
    expect(result.compactMode).toBe(true);
    expect(result.showStatusBar).toBe(false);
    expect(result.showActionBar).toBe(true);
  });

  it('falls back to the legacy shadow key when shadowDepth is absent', () => {
    const result = normalizeAppearanceSettings({ shadow: 'strong' });
    expect(result.shadowDepth).toBe('strong');
  });

  it('uses defaults when the payload is null', () => {
    expect(normalizeAppearanceSettings(null)).toEqual(REFERENCE_DEFAULT);
  });
});

describe('buildAppearancePayload', () => {
  it('produces the full DTO contract with correct types', () => {
    const payload = buildAppearancePayload(REFERENCE_DEFAULT);
    expect(payload).toEqual({
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
    });
  });

  it('never emits the legacy shadow key', () => {
    expect('shadow' in buildAppearancePayload(REFERENCE_DEFAULT)).toBe(false);
  });
});

describe('gradient helpers', () => {
  it('effectiveGradientSecond is accent at 100 and base at 0', () => {
    expect(effectiveGradientSecond('#2563eb', '#14b8a6', 100)).toBe('#14b8a6');
    expect(effectiveGradientSecond('#2563eb', '#14b8a6', 0)).toBe('#2563eb');
  });

  it('buildGradientCss returns a solid color when gradients are disabled', () => {
    expect(buildGradientCss({ ...REFERENCE_DEFAULT, gradientEnabled: false })).toBe(REFERENCE_DEFAULT.primaryColor);
  });

  it('buildGradientCss respects direction and focus stops', () => {
    const css = buildGradientCss({ ...REFERENCE_DEFAULT, gradientDirection: 'TOP_TO_BOTTOM', gradientFocus: 'CONCENTRATED' });
    expect(css).toContain('180deg');
    expect(css).toContain('0%');
    expect(css).toContain('35%');
  });

  it('strength 0 makes the gradient visually flat (base through the whole band)', () => {
    const css = buildGradientCss({ ...REFERENCE_DEFAULT, gradientStrength: 0 });
    expect(css).toContain(REFERENCE_DEFAULT.primaryColor);
  });
});

describe('color helpers', () => {
  it('mixHex blends two colors', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('shadeHex darkens a color', () => {
    expect(shadeHex('#2563eb', 0.5)).toBe('#133276');
  });
});

describe('shape helpers', () => {
  it('buildRadiusValue maps radius tokens to px values', () => {
    expect(buildRadiusValue('small')).toBe('.375rem');
    expect(buildRadiusValue('medium')).toBe('.625rem');
    expect(buildRadiusValue('large')).toBe('1rem');
  });

  it('SHADOW_DEPTH_VALUES covers every supported depth', () => {
    expect(Object.keys(SHADOW_DEPTH_VALUES).sort()).toEqual(['light', 'medium', 'strong']);
  });

  it('buildSidebarPalette uses a palette for known backgrounds and derives custom from primary', () => {
    expect(buildSidebarPalette({ sidebarBg: 'slate', primaryColor: '#2563eb' })).toEqual(SIDEBAR_BG_PALETTES.slate);
    const custom = buildSidebarPalette({ sidebarBg: 'custom', primaryColor: '#2563eb' });
    expect(custom.secondary).toBe('#2563eb');
    expect(custom.main).not.toBe('#2563eb');
  });
});

describe('preset profiles', () => {
  it('FLAT disables gradients', () => {
    expect(PRESET_PROFILES.FLAT.gradientEnabled).toBe(false);
    expect(PRESET_PROFILES.FLAT.gradientStrength).toBe(0);
  });

  it('every preset is selectable and idempotent with its own value', () => {
    for (const preset of Object.keys(PRESET_PROFILES) as Array<keyof typeof PRESET_PROFILES>) {
      expect(PRESET_PROFILES[preset].preset).toBe(preset);
    }
  });
});
