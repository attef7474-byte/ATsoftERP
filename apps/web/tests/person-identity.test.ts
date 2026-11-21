import React from 'react';
import { Input } from '../src/components/admin/ui/input';
import { isFullPersonName, isLocalYemenPhone, localYemenPhone, normalizePersonName } from '../src/lib/person-identity';
const { create, act } = require('react-test-renderer');

describe('person identity form rules', () => {
  it.each(['عاطف علي', 'عاطف علي عبدالله', '', '   '])('rejects short name %p', name => expect(isFullPersonName(name)).toBe(false));
  it.each(['عاطف علي عبدالله زيد', 'Ali Hassan Ahmed Saleh Zaid'])('accepts full name %p', name => expect(isFullPersonName(name)).toBe(true));
  it('normalizes whitespace without changing letters', () => expect(normalizePersonName('  أحمد\tعلي   حسن عبدالله ')).toBe('أحمد علي حسن عبدالله'));
  it.each(['77174977', '7717497760', '771 749776', 'abcd12345', '+967771749776', '٧٧١٧٤٩٧٧٦'])('rejects invalid local input %p', phone => expect(isLocalYemenPhone(phone)).toBe(false));
  it.each(['771749776', '734053717', '700600123', '711255777', ''])('accepts optional or nine-digit input %p', phone => expect(isLocalYemenPhone(phone)).toBe(true));
  it.each(['771749776', '+967771749776', '00967771749776'])('hydrates %p to nine local digits', phone => expect(localYemenPhone(phone)).toBe('771749776'));
  it('preserves invalid legacy data for explicit correction', () => expect(localYemenPhone('bad legacy')).toBe('bad legacy'));
  it.each(['rtl', 'ltr'])('renders one noneditable prefix and an accessible local input in %s', dir => {
    let view: any;
    act(() => { view = create(React.createElement('form', { dir }, React.createElement(Input, {
      id: 'phone', name: 'phone', label: 'Phone', fixedPrefix: '+967', type: 'tel', inputMode: 'numeric',
      pattern: '[0-9]{9}', maxLength: 9, value: '771749776', onChange: () => {}, error: 'Invalid phone',
    }))); });
    expect(view.root.findByProps({ 'data-phone-prefix': true }).children).toEqual(['+967']);
    const input = view.root.findByType('input');
    expect(input.props).toMatchObject({ id: 'phone', name: 'phone', maxLength: 9, inputMode: 'numeric', 'aria-invalid': true });
    expect(view.root.findByType('label').props.htmlFor).toBe('phone');
    expect(view.root.findAllByType('input')).toHaveLength(1);
    act(() => view.unmount());
  });
});
