import * as fs from 'fs';
import * as path from 'path';

const base = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.resolve(base, rel), 'utf8');

const CANONICAL = 'src/components/admin/ui/modal.tsx';
const MACHINE_FORM = 'src/app/admin/maintenance/machines/machine-form.tsx';
const MACHINE_PAGE = 'src/app/admin/maintenance/machines/page.tsx';

describe('R6 canonical Modal nested stacking', () => {
  const modal = read(CANONICAL);

  describe('canonical Modal exposes reusable stacking so nested modals do not both close', () => {
    it('tracks an order-preserving module-level stack', () => {
      expect(modal).toContain('openModals');
      expect(modal).toContain('modalSeq');
      expect(modal).toContain('openModals.push(id)');
    });

    it('determines topmost ownership per modal instance', () => {
      expect(modal).toContain('const isTopmost = () =>');
      expect(modal).toMatch(/openModals\[openModals\.length - 1\]\s*===\s*id/);
    });

    it('only the topmost Modal acts on Escape so one Escape closes only the top dialog', () => {
      expect(modal).toMatch(/if \(!isTopmost\(\)\) return;/);
      expect(modal).toContain("event.key === 'Escape'");
    });

    it('owns the Tab focus trap only while topmost', () => {
      expect(modal).toMatch(/if \(!isTopmost\(\)\) return;/);
      expect(modal).toContain("if (event.key !== 'Tab') return;");
    });

    it('grands back ownership to the modal below when the topmost closes (stack pop)', () => {
      expect(modal).toContain('.lastIndexOf(id)');
      expect(modal).toContain('.splice(idx, 1)');
    });
  });

  describe('the machine + cost center modals share the same canonical Modal (so nesting is coordinated)', () => {
    const form = read(MACHINE_FORM);
    const page = read(MACHINE_PAGE);

    it('the nested cost center modal and the machine modal both come from components/admin/ui', () => {
      expect(modal).toContain('export function Modal');
      expect(form).toContain("from '../../../../components/admin/ui'");
    });

    it('the machine list modal uses the canonical Modal component', () => {
      expect(page).toContain('<Modal open={modalOpen}');
      expect(page).toContain('Modal');
    });

    it('the nested cost center modal lives inside the shared MachineForm using the canonical Modal', () => {
      expect(form).toContain('<Modal open={ccModalOpen}');
      expect(form).toContain('title={t(\'maintenance.createMachineCostCenter\')}');
    });
  });
});
