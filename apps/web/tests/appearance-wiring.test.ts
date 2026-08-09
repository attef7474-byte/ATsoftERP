import * as fs from 'fs';
import * as path from 'path';
import { buildFormHeaderTokens, PRESET_PROFILES, REFERENCE_DEFAULT } from '../src/lib/appearance-theme';

const repoRoot = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

describe('form-header token logic', () => {
  it('uses navy text and a light border on gradient headers', () => {
    expect(buildFormHeaderTokens({ gradientEnabled: true })).toEqual({
      text: '#073d7d',
      border: 'rgba(7,61,125,.14)',
    });
  });

  it('uses white text and a light border on solid (FLAT) headers', () => {
    expect(buildFormHeaderTokens({ gradientEnabled: false })).toEqual({
      text: '#ffffff',
      border: 'rgba(255,255,255,.22)',
    });
  });

  it('FLAT disables gradients so headers render solid primary with white text', () => {
    expect(PRESET_PROFILES.FLAT.gradientEnabled).toBe(false);
    expect(buildFormHeaderTokens({ gradientEnabled: false }).text).toBe('#ffffff');
  });
});

describe('GLASS preset selector logic', () => {
  it('GLASS keeps gradients enabled and supplies the glass opacity/blur tokens the selector consumes', () => {
    const glass = PRESET_PROFILES.GLASS;
    expect(glass.gradientEnabled).not.toBe(false);
    expect(glass.glassOpacity).toBe(0.55);
    expect(glass.glassBlur).toBe(22);
  });

  it('REFERENCE_DEFAULT is not translucent-by-default', () => {
    expect(REFERENCE_DEFAULT.preset).toBe('REFERENCE_DEFAULT');
    expect(buildFormHeaderTokens(REFERENCE_DEFAULT).text).toBe('#073d7d');
  });
});

describe('globals.css theme wiring', () => {
  const css = read('src/app/globals.css');

  it('scopes the translucent dialog glass surface to GLASS preset only', () => {
    expect(css).toContain('html[data-appearance-preset="GLASS"] [role=dialog]');
    expect(css).toContain('html[data-appearance-preset="GLASS"] .admin-modal');
    expect(css).toContain('html[data-appearance-preset="GLASS"] .admin-drawer');
  });

  it('no longer applies an unscoped translucent background to every dialog in every preset', () => {
    const unscoped = css.match(/\[role=dialog\],\.admin-modal,\.admin-drawer\{background:rgba\(255,255,255,var\(--ats-glass-opacity\)\)/);
    expect(unscoped).toBeNull();
  });

  it('form headers consume the derived token, not an arbitrary hard-coded blue', () => {
    expect(css).toContain('[data-form-header],.ats-form-header{background:var(--ats-form-header-gradient)');
    expect(css).not.toContain('--ats-form-header-gradient:linear-gradient(135deg,#2563eb,#14b8a6)');
  });

  it('form header text and border are tokenized', () => {
    expect(css).toContain('color:var(--ats-form-header-text)');
    expect(css).toContain('border-bottom:1px solid var(--ats-form-header-border)');
  });
});

describe('component hook wiring (data-form-header / data-theme-preview)', () => {
  const sources: Record<string, string> = {
    modal: read('src/components/admin/ui/modal.tsx'),
    pageHeader: read('src/components/admin/ui/page-header.tsx'),
    entityPageHeader: read('src/components/entity/entity-page-header.tsx'),
    entityDetailDrawer: read('src/components/entity/entity-detail-drawer.tsx'),
    appearanceStudio: read('src/app/admin/settings/appearance/page.tsx'),
    warehouseNew: read('src/app/admin/inventory/warehouses/new/page.tsx'),
    warehouseEdit: read('src/app/admin/inventory/warehouses/[id]/edit/page.tsx'),
  };

  it.each([
    ['modal', 'data-form-header'],
    ['pageHeader', 'data-form-header'],
    ['entityPageHeader', 'data-form-header'],
    ['entityDetailDrawer', 'data-form-header'],
    ['warehouseNew', 'data-form-header'],
    ['warehouseEdit', 'data-form-header'],
  ])('%s renders the form-header hook', (file, hook) => {
    expect(sources[file]).toContain(hook);
  });

  it('wires the live preview hook to the real studio PreviewPanel container', () => {
    expect(sources.appearanceStudio).toContain('data-theme-preview');
  });

  it('no longer leaves the preview hook with zero consumers across the app', () => {
    const appFiles = fs.readdirSync(path.join(repoRoot, 'src/app/admin/settings/appearance'));
    expect(appFiles.length).toBeGreaterThan(0);
    expect(sources.appearanceStudio).toContain('data-theme-preview');
  });
});
