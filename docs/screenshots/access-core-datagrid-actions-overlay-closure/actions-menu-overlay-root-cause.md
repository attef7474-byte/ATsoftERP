# Actions Menu Overlay Root Cause

## Stacking Context Analysis

The admin shell layout uses fixed-position containers with z-index layering:

| Layer        | CSS                        | z-index |
|-------------|----------------------------|---------|
| Top bar      | `.admin-topbar` (fixed)    | 60      |
| Action bar   | `.admin-actionbar` (fixed) | 55      |
| Sidebar      | `.admin-sidebar` (fixed)   | 50      |
| Main content | `.admin-main` (fixed)      | 40      |
| Status bar   | `.admin-statusbar` (fixed) | 55      |

The AdminDataGrid renders inside `.admin-main` (z-index: 40), which creates
a stacking context. The dropdown menu inside it was also at `z-50`, but within
`.admin-main`'s stacking context, not the root. The sidebar at z-index: 50 in
the root always wins.

Additionally, overflow clipping on the grid wrapper container cut off the
absolutely-positioned dropdown.

## Solution

Portal the dropdown to `document.body` with `position: fixed` and
`z-index: 100`, bypassing all intermediate stacking contexts.
