import React from 'react';
import en from '../src/lib/i18n/locales/en';
const { act, create } = require('react-test-renderer');
const mockGet = jest.fn();
const mockT = (key: string) => key.split('.').reduce<any>((node, part) => node?.[part], en);
const mockContext = { activeContext: { companyId: 'ca', branchId: 'ba' }, contextVersion: 1 };
jest.mock('../src/lib/api', () => ({ api: { get: (...args: any[]) => mockGet(...args) } }));
jest.mock('../src/lib/auth-context', () => ({ useOperationalContext: () => mockContext }));
jest.mock('../src/lib/i18n/use-translation', () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock('next/navigation', () => ({ usePathname: () => '/admin/inventory/issues' }));
jest.mock('../src/components/f9/F9LookupModal', () => ({ F9LookupModal: () => null }));
import { F9Lookup } from '../src/components/f9/F9Lookup';
const adapter: any = { endpoint: '/inventory/issues/candidates', detailFilters: true, displayLabel: (item: any) => item.name, searchFields: ['name'], columns: [] };
const onChange = jest.fn();
let tree: any;
function element(value: string, warehouseId: string) { return React.createElement(F9Lookup, { value, onChange, adapter, filters: { type: 'FINISHED_GOOD', warehouseId } }); }
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; jest.clearAllMocks(); });

describe('warehouse-scoped F9 detail requests', () => {
  it('sends the warehouse context on detail resolution and discards a late response after dependent clearing', async () => {
    let resolve: any;
    mockGet.mockReturnValue(new Promise((done) => { resolve = done; }));
    await act(async () => { tree = create(element('product-a', 'warehouse-a')); });
    expect(mockGet).toHaveBeenCalledWith('/inventory/issues/candidates/product-a', { params: { type: 'FINISHED_GOOD', warehouseId: 'warehouse-a' } });
    await act(async () => { tree.update(element('', 'warehouse-b')); });
    await act(async () => { resolve({ data: { id: 'product-a', name: 'A-ONLY-STOCK' } }); });
    expect(JSON.stringify(tree.toJSON())).not.toContain('A-ONLY-STOCK');
  });

  it('invalidates cached detail when the warehouse filter changes', async () => {
    mockGet.mockResolvedValue({ data: { id: 'shared', name: 'A-LABEL' } });
    await act(async () => { tree = create(React.createElement(F9Lookup, { value: 'shared', onChange, adapter, clearOnFilterChange: false, filters: { type: 'FINISHED_GOOD', warehouseId: 'warehouse-a' } })); });
    expect(JSON.stringify(tree.toJSON())).toContain('A-LABEL');
    mockGet.mockResolvedValue({ data: { id: 'shared', name: 'B-LABEL' } });
    await act(async () => { tree.update(React.createElement(F9Lookup, { value: 'shared', onChange, adapter, clearOnFilterChange: false, filters: { type: 'FINISHED_GOOD', warehouseId: 'warehouse-b' } })); });
    expect(mockGet).toHaveBeenLastCalledWith('/inventory/issues/candidates/shared', { params: { type: 'FINISHED_GOOD', warehouseId: 'warehouse-b' } });
    expect(JSON.stringify(tree.toJSON())).toContain('B-LABEL');
    expect(JSON.stringify(tree.toJSON())).not.toContain('A-LABEL');
  });

  it('shows a localized detail error instead of an internal identifier on scoped failure', async () => {
    mockGet.mockRejectedValue(new Error('denied'));
    await act(async () => { tree = create(element('private-product-id', 'warehouse-a')); });
    expect(JSON.stringify(tree.toJSON())).toContain(en.errors.loadFailed);
    const inputText = tree.root.findAllByType('span').map((node: any) => node.props.children).join(' ');
    expect(inputText).not.toContain('private-product-id');
  });
});
