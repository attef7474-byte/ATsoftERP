/// <reference types="next" />
import React from 'react';
const { create, act } = require('react-test-renderer');
jest.mock('../src/components/admin/datagrid/row-tone.module.css', () => ({ __esModule: true, default: { row: 'shared-row' } }));
jest.mock('../src/lib/i18n/use-translation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../src/lib/auth-context', () => ({ useOptionalAuth: () => null }));
jest.mock('../src/components/admin/datagrid/actions-menu', () => ({ ActionsCell: () => null, ActionsHeader: () => null }));
import { AdminDataGrid } from '../src/components/admin/admin-data-grid';
import { BodyRow } from '../src/components/admin/datagrid/body-row';
import { EntityDataTable } from '../src/components/entity/entity-data-table';
import { maintenanceRequestRowTone } from '../src/lib/maintenance-row-tones';

let tree: any;
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; });
const data = [{ id: 'one', status: 'OPEN' }, { id: 'two', status: 'IN_PROGRESS' }];
const columns = [{ key: 'status', header: 'State' }];

describe('shared row-state grid contract', () => {
  it.each(['rtl', 'ltr'])('forwards semantics through EntityDataTable in %s and recalculates on updates', (dir) => {
    const props: any = { columns, data, keyExtractor: (item: any) => item.id, getRowTone: maintenanceRequestRowTone, dir };
    act(() => { tree = create(React.createElement(EntityDataTable, props)); });
    expect(tree.root.findAllByType(BodyRow).map((row: any) => row.props.tone)).toEqual(['attention', 'in-progress']);
    expect(tree.root.findAllByType('tr').slice(-2).map((row: any) => row.props['data-row-tone'])).toEqual(['attention', 'in-progress']);
    act(() => tree.update(React.createElement(EntityDataTable, { ...props, data: [{ id: 'one', status: 'COMPLETED' }] })));
    expect(tree.root.findByType(BodyRow).props.tone).toBe('normal');
  });

  it('keeps legacy grids normal with alternating parity and independent selection', () => {
    act(() => { tree = create(React.createElement(AdminDataGrid, { columns, data, keyExtractor: (item: any) => item.id, selectedKey: 'two' })); });
    const rows = tree.root.findAllByType('tr').slice(-2);
    expect(rows.map((row: any) => row.props['data-row-tone'])).toEqual(['normal', 'normal']);
    expect(rows.map((row: any) => row.props['data-row-parity'])).toEqual(['even', 'odd']);
    expect(rows.map((row: any) => row.props['aria-selected'])).toEqual([false, true]);
  });

  it('preserves action click guarding and row selection on a colored row', () => {
    const onRowClick = jest.fn();
    act(() => { tree = create(React.createElement(AdminDataGrid<typeof data[number]>, { columns, data, keyExtractor: (item) => item.id, getRowTone: maintenanceRequestRowTone, onRowClick })); });
    const row = tree.root.findAllByType('tr').slice(-2)[0];
    act(() => row.props.onClick({ target: { closest: () => ({ tagName: 'BUTTON' }) } }));
    expect(onRowClick).not.toHaveBeenCalled();
    act(() => row.props.onClick({ target: { closest: () => null } }));
    expect(onRowClick).toHaveBeenCalledWith(data[0]);
  });
});
