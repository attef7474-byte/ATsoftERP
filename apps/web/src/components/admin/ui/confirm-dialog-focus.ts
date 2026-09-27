export const CONFIRM_DIALOG_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface FocusableLike {
  focus(): void;
}

export interface FocusableRoot {
  querySelectorAll(selectors: string): ArrayLike<FocusableLike>;
}

export type TabResolution =
  | { kind: 'focus'; target: FocusableLike }
  | { kind: 'hold' };

export function collectFocusable(
  root: FocusableRoot,
  isVisible: (element: FocusableLike) => boolean = () => true,
): FocusableLike[] {
  const found = root.querySelectorAll(CONFIRM_DIALOG_FOCUSABLE_SELECTOR);
  const result: FocusableLike[] = [];
  for (let index = 0; index < found.length; index += 1) {
    const element = found[index];
    if (element && isVisible(element)) result.push(element);
  }
  return result;
}

export function resolveInitialFocus(focusable: FocusableLike[], container: FocusableLike): FocusableLike {
  return focusable.length > 0 ? focusable[0] : container;
}

export function resolveTabTarget(args: {
  focusable: FocusableLike[];
  active: FocusableLike | null;
  container: FocusableLike;
  shiftKey: boolean;
}): TabResolution {
  const { focusable, active, container, shiftKey } = args;
  if (focusable.length === 0) return { kind: 'hold' };

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const focusIsOutside = active === null || (active !== container && !focusable.includes(active));

  if (shiftKey) {
    if (active === first || active === container || focusIsOutside) return { kind: 'focus', target: last };
    return { kind: 'hold' };
  }
  if (active === last || active === container || focusIsOutside) return { kind: 'focus', target: first };
  return { kind: 'hold' };
}

export function shouldCloseOnEscape(loading: boolean | undefined): boolean {
  return !loading;
}
