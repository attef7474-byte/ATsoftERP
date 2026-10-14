import * as fs from 'fs';
import * as path from 'path';

const webRoot = path.resolve(__dirname, '..');
const apiRoot = path.resolve(__dirname, '../../api');
const read = (rel: string) => fs.readFileSync(path.resolve(webRoot, rel), 'utf8');
const readApi = (rel: string) => fs.readFileSync(path.resolve(apiRoot, rel), 'utf8');

const PAGE = 'src/app/admin/installed-parts/page.tsx';
const DETAIL = 'src/app/admin/installed-parts/[id]/page.tsx';
const PERMISSION_KEYS = 'src/lib/permission-keys.ts';
const EN_MAINT = 'src/lib/i18n/locales/en/maintenance.ts';
const AR_MAINT = 'src/lib/i18n/locales/ar/maintenance.ts';

const SERVICE = 'src/modules/factory/maintenance/installed-parts-replacement/installed-parts-replacement.service.ts';
const CONTROLLER = 'src/modules/factory/maintenance/installed-parts-replacement/installed-parts-replacement.controller.ts';
const DTO = 'src/modules/factory/maintenance/installed-parts-replacement/dto/installed-parts-replacement.dto.ts';
const SEED = 'prisma/seed/seed-cmms-permission-keys.ts';

describe('Machine installed parts lifecycle (register / remove)', () => {
  describe('W1/W2. List page loads and shows human-readable identity', () => {
    it('renders the Installed Parts page with the shared data grid', () => {
      const page = read(PAGE);
      expect(page).toContain("t('maintenance.installedParts')");
      expect(page).toContain('<AdminDataGrid');
    });
    it('columns use human-readable machine/component/spare-part identity, not raw ids', () => {
      const page = read(PAGE);
      expect(page).toContain("t('maintenance.machine')");
      expect(page).toContain("t('maintenance.machineComponent')");
      expect(page).toContain("t('maintenance.sparePartLabel')");
      expect(page).toContain('p.machine.code');
      expect(page).toContain('p.sparePart.code');
    });
  });

  describe('W3/W4. Derived, read-only product; no raw technical input duplication', () => {
    it('derived product block is read-only and labelled', () => {
      const page = read(PAGE);
      expect(page).toContain('data-testid="derived-part"');
      expect(page).toContain("t('maintenance.derivedProduct')");
      expect(page).toContain('selectedSparePart.product');
    });
    it('the register form never submits a client-chosen productId', () => {
      const page = read(PAGE);
      expect(page).not.toMatch(/payload\.productId/);
      expect(page).not.toContain('productId:');
    });
  });

  describe('W5/W6/W7. Filters, machine→component cascade, spare-part selector', () => {
    it('machine + status filters are present and drive the query', () => {
      const page = read(PAGE);
      expect(page).toContain('machineAdapter');
      expect(page).toContain("params.set('machineId'");
      expect(page).toContain("params.set('status'");
    });
    it('component cascades from the selected machine and is disabled without one', () => {
      const page = read(PAGE);
      expect(page).toContain('machineComponentAdapter');
      expect(page).toContain('filters={form.machineId ? { machineId: form.machineId } : undefined}');
      expect(page).toContain('disabled={!form.machineId}');
    });
    it('a canonical spare-part selector is used', () => {
      expect(read(PAGE)).toContain('sparePartAdapter');
    });
  });

  describe('W8/W9. Cascading reset and form reset on open', () => {
    it('changing the machine clears the selected component', () => {
      expect(read(PAGE)).toContain("machineComponentId: ''");
    });
    it('opening the register modal resets the form and mints a submission key', () => {
      const page = read(PAGE);
      expect(page).toContain('openRegister');
      expect(page).toContain('clientRequestId: newRequestId()');
      expect(page).toContain('setValidationErrors({})');
    });
  });

  describe('W10. Manual historical registration posts to the canonical endpoint', () => {
    it('register posts to POST /installed-parts with an idempotency key', () => {
      const page = read(PAGE);
      expect(page).toContain("api.post<{ applicability?: { applicable: boolean } }>('/installed-parts'");
      expect(page).toContain('clientRequestId: form.clientRequestId');
    });
    it('a SOFT applicability notice is surfaced without blocking the save', () => {
      const page = read(PAGE);
      expect(page).toContain("t('maintenance.applicabilityWarning')");
      expect(page).toContain('applicability.applicable === false');
    });
  });

  describe('W11/W12. Removal action and history visibility', () => {
    it('the detail page exposes a permission-gated remove action', () => {
      const detail = read(DETAIL);
      expect(detail).toContain('PERMISSION_KEYS.INSTALLED_PARTS_UPDATE');
      expect(detail).toContain('api.post(`/installed-parts/${params.id}/remove`');
      expect(detail).toContain("newStatus: 'REMOVED'");
      expect(detail).toContain('<ConfirmDialog');
    });
    it('removed/decommissioned states remain selectable in the list filter (history preserved)', () => {
      const page = read(PAGE);
      expect(page).toContain("'REMOVED'");
      expect(page).toContain("'REPLACED'");
      expect(page).toContain('STATUS_OPTIONS');
    });
  });

  describe('W13. Permission-aware actions use real seeded keys', () => {
    it('register action is gated by the create permission key', () => {
      expect(read(PAGE)).toContain('PERMISSION_KEYS.INSTALLED_PARTS_CREATE');
    });
    it('the new permission keys exist in the web registry', () => {
      const keys = read(PERMISSION_KEYS);
      expect(keys).toContain('INSTALLED_PARTS_CREATE');
      expect(keys).toContain('INSTALLED_PARTS_UPDATE');
    });
    it('the new permission keys are seeded', () => {
      const seed = readApi(SEED);
      expect(seed).toContain('installed-parts:create');
      expect(seed).toContain('installed-parts:update');
    });
  });

  describe('W14. Arabic and English translation keys exist', () => {
    it('both locales define the installed-parts lifecycle keys', () => {
      const keys = [
        'registerInstalledPart',
        'removeInstalledPart',
        'confirmRemoveInstalledPart',
        'installedPartRegistered',
        'installedPartRemoved',
        'derivedProduct',
        'batchNumber',
        'installedDate',
        'applicabilityWarning',
        'registerPartHint',
        'noMachineSelected',
      ];
      const en = read(EN_MAINT);
      const ar = read(AR_MAINT);
      for (const k of keys) {
        expect(en).toContain(`${k}:`);
        expect(ar).toContain(`${k}:`);
      }
    });
  });

  describe('W15/W16. Backend contract: manual register is not an inventory issue', () => {
    it('the service exposes register and remove operations', () => {
      const service = readApi(SERVICE);
      expect(service).toContain('registerExistingInstallation');
      expect(service).toContain('removeInstalledPart');
      expect(service).toContain("sourceType: 'MANUAL_REGISTRATION'");
    });
    it('registration never writes an inventory movement (inventoryMovementId stays null)', () => {
      const service = readApi(SERVICE);
      expect(service).toContain('inventoryMovementId: data.inventoryMovementId || null');
      expect(service).not.toContain('inventoryMovement.create');
    });
    it('the controller exposes POST / and POST /:id/remove with permissions', () => {
      const controller = readApi(CONTROLLER);
      expect(controller).toContain("@Post()");
      expect(controller).toContain("@Post(':id/remove')");
      expect(controller).toContain("@Permissions('installed-parts:create')");
      expect(controller).toContain("@Permissions('installed-parts:update')");
    });
    it('the static POST / route is declared before the :id route so it is not shadowed', () => {
      const controller = readApi(CONTROLLER);
      const rootIdx = controller.indexOf('@Post()');
      const removeIdx = controller.indexOf("@Post(':id/remove')");
      expect(rootIdx).toBeGreaterThan(-1);
      expect(removeIdx).toBeGreaterThan(-1);
      expect(rootIdx).toBeLessThan(removeIdx);
    });
  });

  describe('W17. DTO validation and tenant/component invariants', () => {
    it('register/remove DTOs declare validation decorators', () => {
      const dto = readApi(DTO);
      expect(dto).toContain('RegisterInstalledPartDto');
      expect(dto).toContain('RemoveInstalledPartDto');
      expect(dto).toContain('INSTALLED_PART_CONDITIONS');
      expect(dto).toContain('IsNotEmpty');
    });
    it('the service validates component ownership and tenant scope', () => {
      const service = readApi(SERVICE);
      expect(service).toContain('assertMachineComponentBelongsToMachine');
      expect(service).toContain('machineAccess');
      expect(service).toContain('partAccess');
    });
  });
});
