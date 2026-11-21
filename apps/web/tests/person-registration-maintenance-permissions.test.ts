import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(path.join(__dirname, '../src/app/admin/maintenance/personnel/page.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
function registeredActions(keys: string[], superAdmin = false): any[] {
  let actions: any[] = [];
  const React = { createElement: () => ({}), useState: (value: any) => [value, () => {}], useEffect: () => {}, useMemo: (factory: any) => factory(), useCallback: (callback: any) => callback };
  const exported: any = {};
  vm.runInNewContext(compiled, {
    exports: exported,
    require: (name: string) => {
      if (name === 'react') return React;
      if (name === 'next/navigation') return { useRouter: () => ({ push: () => {} }) };
      if (name.endsWith('/person-identity')) return require('../src/lib/person-identity');
      if (name.endsWith('/auth-context')) return { useAuth: () => ({ permissions: { permissions: keys }, isSuperAdmin: superAdmin }) };
      if (name.endsWith('/use-translation')) return { useTranslation: () => ({ t: (key: string) => key, dir: 'ltr' }) };
      if (name.endsWith('/toast-provider')) return { useToast: () => ({ showToast: () => {} }) };
      if (name.endsWith('/error-handler')) return { useApiErrorHandler: () => () => {} };
      if (name.endsWith('/admin-action-bar')) return { useRegisterAdminActions: (value: any[]) => { actions = value; }, useStableHandlers: () => ({ exec: () => {} }) };
      return new Proxy({}, { get: (_target, key) => String(key) });
    },
  });
  exported.default();
  return actions;
}
const required = ['maintenance-personnel:create', 'operational-person:create', 'person-assignment:create'];
describe('maintenance registration action permission boundary', () => {
  it('hides creation when the person-create permission is missing', () => {
    expect(registeredActions(required.filter(key => key !== 'operational-person:create')).some(action => action.id === 'add')).toBe(false);
  });
  it('shows registration when all canonical create permissions are granted', () => {
    expect(registeredActions(required).some(action => action.id === 'add')).toBe(true);
  });
  it('preserves explicit SUPER_ADMIN access', () => {
    expect(registeredActions([], true).some(action => action.id === 'add')).toBe(true);
  });
});
