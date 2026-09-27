import {
  CONFIRM_DIALOG_FOCUSABLE_SELECTOR,
  collectFocusable,
  resolveInitialFocus,
  resolveTabTarget,
  shouldCloseOnEscape,
} from '../src/components/admin/ui/confirm-dialog-focus';

function fakeElement(name: string) {
  const element = {
    name,
    focused: 0,
    focus() {
      element.focused += 1;
    },
  };
  return element;
}

function fakeRoot(elements: ReturnType<typeof fakeElement>[]) {
  return {
    querySelectorAll: () => elements,
  };
}

describe('confirm dialog focus management', () => {
  describe('CONFIRM_DIALOG_FOCUSABLE_SELECTOR', () => {
    it('targets the interactive elements a dialog can hold', () => {
      expect(CONFIRM_DIALOG_FOCUSABLE_SELECTOR).toContain('button:not([disabled])');
      expect(CONFIRM_DIALOG_FOCUSABLE_SELECTOR).toContain('a[href]');
      expect(CONFIRM_DIALOG_FOCUSABLE_SELECTOR).toContain('input:not([disabled])');
      expect(CONFIRM_DIALOG_FOCUSABLE_SELECTOR).toContain('select:not([disabled])');
      expect(CONFIRM_DIALOG_FOCUSABLE_SELECTOR).toContain('textarea:not([disabled])');
    });

    it('excludes disabled controls and the roving tabindex sentinel', () => {
      expect(CONFIRM_DIALOG_FOCUSABLE_SELECTOR).toContain('button:not([disabled])');
      expect(CONFIRM_DIALOG_FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
    });
  });

  describe('collectFocusable', () => {
    it('returns every focusable element in document order', () => {
      const a = fakeElement('a');
      const b = fakeElement('b');
      const c = fakeElement('c');
      expect(collectFocusable(fakeRoot([a, b, c]))).toEqual([a, b, c]);
    });

    it('drops elements rejected by the visibility predicate', () => {
      const visible = fakeElement('visible');
      const hidden = fakeElement('hidden');
      const result = collectFocusable(fakeRoot([visible, hidden]), (el) => el === visible);
      expect(result).toEqual([visible]);
    });

    it('returns an empty list when the dialog exposes no control', () => {
      expect(collectFocusable(fakeRoot([]))).toEqual([]);
    });
  });

  describe('resolveInitialFocus', () => {
    it('moves focus to the first control when one exists', () => {
      const first = fakeElement('first');
      const second = fakeElement('second');
      const container = fakeElement('container');
      expect(resolveInitialFocus([first, second], container)).toBe(first);
    });

    it('falls back to the dialog container when there is nothing to focus', () => {
      const container = fakeElement('container');
      expect(resolveInitialFocus([], container)).toBe(container);
    });
  });

  describe('resolveTabTarget forward tab', () => {
    it('keeps focus where it is in the middle of the dialog', () => {
      const first = fakeElement('first');
      const middle = fakeElement('middle');
      const last = fakeElement('last');
      const result = resolveTabTarget({ focusable: [first, middle, last], active: middle, container: fakeElement('c'), shiftKey: false });
      expect(result).toEqual({ kind: 'hold' });
    });

    it('wraps from the last control back to the first', () => {
      const first = fakeElement('first');
      const last = fakeElement('last');
      const result = resolveTabTarget({ focusable: [first, last], active: last, container: fakeElement('c'), shiftKey: false });
      expect(result).toEqual({ kind: 'focus', target: first });
    });

    it('recovers focus into the dialog when it had escaped', () => {
      const first = fakeElement('first');
      const outside = fakeElement('outside');
      const result = resolveTabTarget({ focusable: [first], active: outside, container: fakeElement('c'), shiftKey: false });
      expect(result).toEqual({ kind: 'focus', target: first });
    });

    it('reclaims focus from the container itself', () => {
      const first = fakeElement('first');
      const container = fakeElement('c');
      const result = resolveTabTarget({ focusable: [first], active: container, container, shiftKey: false });
      expect(result).toEqual({ kind: 'focus', target: first });
    });

    it('holds focus on the container when no control is focusable', () => {
      const result = resolveTabTarget({ focusable: [], active: null, container: fakeElement('c'), shiftKey: false });
      expect(result).toEqual({ kind: 'hold' });
    });
  });

  describe('resolveTabTarget shift tab', () => {
    it('wraps from the first control to the last', () => {
      const first = fakeElement('first');
      const last = fakeElement('last');
      const result = resolveTabTarget({ focusable: [first, last], active: first, container: fakeElement('c'), shiftKey: true });
      expect(result).toEqual({ kind: 'focus', target: last });
    });

    it('keeps focus where it is in the middle of the dialog', () => {
      const first = fakeElement('first');
      const middle = fakeElement('middle');
      const last = fakeElement('last');
      const result = resolveTabTarget({ focusable: [first, middle, last], active: middle, container: fakeElement('c'), shiftKey: true });
      expect(result).toEqual({ kind: 'hold' });
    });

    it('recovers focus into the dialog when it had escaped', () => {
      const last = fakeElement('last');
      const outside = fakeElement('outside');
      const result = resolveTabTarget({ focusable: [last], active: outside, container: fakeElement('c'), shiftKey: true });
      expect(result).toEqual({ kind: 'focus', target: last });
    });

    it('holds focus on the container when no control is focusable', () => {
      const result = resolveTabTarget({ focusable: [], active: null, container: fakeElement('c'), shiftKey: true });
      expect(result).toEqual({ kind: 'hold' });
    });
  });

  describe('shouldCloseOnEscape', () => {
    it('permits Escape to close the dialog in the normal case', () => {
      expect(shouldCloseOnEscape(undefined)).toBe(true);
      expect(shouldCloseOnEscape(false)).toBe(true);
    });

    it('refuses Escape while a submission is in flight', () => {
      expect(shouldCloseOnEscape(true)).toBe(false);
    });
  });
});
