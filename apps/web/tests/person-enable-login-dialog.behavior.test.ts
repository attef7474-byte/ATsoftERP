import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';

const source = fs.readFileSync(path.join(__dirname, '../src/app/admin/core/persons/enable-login-dialog.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
function nodes(tree: any): any[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
function harness(dir = 'ltr') {
  let cursor = 0;
  const slots: any[] = [];
  const post = jest.fn().mockResolvedValue({});
  const onEnabled = jest.fn(), onClose = jest.fn();
  const onError = jest.fn().mockReturnValue({ errors: [{ field: 'email', message: 'duplicate' }] });
  const React = {
    createElement: (type: any, props: any, ...children: any[]) => ({ type, props: { ...props, children } }),
    useState: (initial: any) => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (v: any) => slots[i] = v]; },
    useRef: (initial: any) => { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
  };
  const exports: any = {};
  vm.runInNewContext(compiled, { exports, require: (name: string) => {
    if (name === 'react') return React;
    if (name.endsWith('/lib/api')) return { api: { post } };
    if (name.endsWith('/admin/ui')) return { Button: 'Button', Input: 'Input', Modal: 'Modal' };
    if (name.endsWith('/use-translation')) return { useTranslation: () => ({ t: (k: string) => k, dir }) };
    if (name.endsWith('/error-handler')) return { useApiErrorHandler: () => onError };
    if (name.endsWith('/form-validation')) return { adaptFieldErrorsToMap: () => ({ email: 'duplicate' }) };
    throw new Error('Unexpected import');
  } });
  const render = () => { cursor = 0; return exports.default({ person: { id: 'p1', code: 'EMP-1', name: 'Existing', phone: '0771', email: 'existing@tenant.test' }, onEnabled, onClose }); };
  const fields = (tree: any) => nodes(tree).filter(n => n.type === 'Input');
  const fill = (tree: any, same = true) => { const value = crypto.randomBytes(24).toString('base64'); const inputs = fields(tree); inputs[1].props.ref.current = { value }; inputs[2].props.ref.current = { value: same ? value : value + 'different' }; return value; };
  const submit = (tree: any) => nodes(tree).find(n => n.type === 'Button' && n.props.children.includes('core.enableSystemAccess')).props.onClick();
  return { render, fields, fill, submit, post, onEnabled, onClose, onError };
}

describe('explicit first-time login dialog', () => {
  it.each(['rtl', 'ltr'])('uses shared dialog, localized labels and %s direction', (dir) => {
    const h = harness(dir); const tree = h.render();
    expect(tree.type).toBe('Modal');
    expect(tree.props.title).toBe('core.enableSystemAccess');
    expect(nodes(tree).find(n => n.props?.['data-testid']).props.dir).toBe(dir);
    expect(h.fields(tree).map(n => n.props.label)).toEqual(['common.email', 'access.password', 'access.confirmPassword']);
    expect(h.fields(tree)[0].props.value).toBe('existing@tenant.test');
  });
  it('rejects missing password locally', async () => {
    const h = harness(); await h.submit(h.render());
    expect(h.post).not.toHaveBeenCalled();
    expect(h.fields(h.render())[1].props.error).toBe('validation.requiredField');
  });
  it('rejects mismatch without transmitting credentials', async () => {
    const h = harness(); const tree = h.render(); h.fill(tree, false); await h.submit(tree);
    expect(h.post).not.toHaveBeenCalled();
    expect(h.fields(h.render())[2].props.error).toBe('validation.passwordMismatch');
  });
  it('calls only enable-login; sends password once but no confirmation, roles or identity fields; clears secrets', async () => {
    const h = harness(); const tree = h.render(); const value = h.fill(tree); await h.submit(tree);
    expect(h.post.mock.calls[0][0]).toBe('/person-registrations/p1/enable-login');
    expect(Object.keys(h.post.mock.calls[0][1])).toEqual(['email', 'password']);
    expect(h.post.mock.calls[0][1].password === value).toBe(true);
    expect(h.fields(tree)[1].props.ref.current.value === '').toBe(true);
    expect(h.fields(tree)[2].props.ref.current.value === '').toBe(true);
    expect(h.onEnabled).toHaveBeenCalledTimes(1);
  });
  it('prevents duplicate submission and close while a request is in flight', async () => {
    const h = harness(); let release: (() => void) | undefined;
    h.post.mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
    const tree = h.render(); h.fill(tree); const first = h.submit(tree); await h.submit(tree);
    tree.props.onClose(); expect(h.onClose).not.toHaveBeenCalled();
    expect(h.post).toHaveBeenCalledTimes(1); release!(); await first;
  });
  it('preserves draft on API error and allows a deliberate retry', async () => {
    const h = harness(); h.post.mockRejectedValueOnce(new Error('business rejection'));
    const tree = h.render(); const value = h.fill(tree); await h.submit(tree);
    expect(h.onEnabled).not.toHaveBeenCalled();
    expect(h.fields(tree)[1].props.ref.current.value === value).toBe(true);
    expect(h.fields(h.render())[0].props.error).toBe('duplicate');
    await h.submit(h.render()); expect(h.onEnabled).toHaveBeenCalledTimes(1);
  });
  it('clears credentials on cancel', () => {
    const h = harness(); const tree = h.render(); h.fill(tree); tree.props.onClose();
    expect(h.fields(tree)[1].props.ref.current.value === '').toBe(true);
    expect(h.fields(tree)[2].props.ref.current.value === '').toBe(true);
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });
});
