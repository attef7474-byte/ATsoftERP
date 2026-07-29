# 05 — Layout / Navigation / Responsive Proof

| Field | Value |
|-------|-------|
| **Batch** | UI-QA — CRUD/DataGrid/Layout/Test Standardization |
| **Phase** | 5 — Layout / Navigation / Responsive |
| **Date** | 2026-07-29 |
| **Status** | COMPLETED |
| **Base Commit** | `2309c09` |

---

## 1. Layout Structure

### 1.1 AdminShell

The `AdminShell` component wraps all admin pages and provides:

| Element | Description | Status |
|---------|-------------|--------|
| **Sidebar** | Collapsible left navigation (RTL-flipped) | ✅ |
| **Topbar** | Title, breadcrumb, user menu, locale switcher | ✅ |
| **Action Bar** | Page-level actions (create, refresh, search) | ✅ |
| **Footer** | Copyright, version | ✅ |
| **Mobile Overlay** | Slide-out menu panel for small screens | ✅ |

### 1.2 Nested Layouts

No nested layouts exist for sub-sections (e.g., no separate layout for inventory vs. maintenance pages). All pages render under `AdminShell`.

**Limitation (documented):** Adding nested layouts would allow section-specific sidebars or breadcrumb overrides. Not implemented. Current flat layout is functional.

### 1.3 Responsive Behavior

| Viewport | Behavior |
|----------|----------|
| Desktop (≥1024px) | Full sidebar + topbar + content |
| Tablet (768–1023px) | Collapsed sidebar, icons only |
| Mobile (<768px) | Sidebar hidden, hamburger menu opens overlay (`MobileMenuPanel`) |
| Content | Single-column layout, cards stack vertically |

No broken layouts on standard viewport sizes.

---

## 2. Sidebar Navigation

### 2.1 Section Inventory

| # | Section | i18n Key | Links to Active Route | Forbidden Module |
|---|---------|----------|----------------------|------------------|
| 1 | Dashboard | `navigation.dashboard` | `/dashboard` ✅ | No |
| 2 | Companies | `navigation.companies` | `/companies` ✅ | No |
| 3 | Branches | `navigation.branches` | `/branches` ✅ | No |
| 4 | Administrations | `navigation.administrations` | `/administrations` ✅ | No |
| 5 | Departments | `navigation.departments` | `/departments` ✅ | No |
| 6 | Users | `navigation.users` | `/users` ✅ | No |
| 7 | Roles | `navigation.roles` | `/roles` ✅ | No |
| 8 | Permissions | `navigation.permissions` | `/permissions` ✅ | No |
| 9 | Products | `navigation.products` | `/products` ✅ | No |
| 10 | Inventory | `navigation.inventory` | `/inventory/*` ✅ | No |
| 11 | Maintenance | `navigation.maintenance` | `/maintenance/*` ✅ | No |
| 12 | Barcodes | `navigation.barcodes` | `/barcodes` ✅ | No |
| 13 | Reports | `navigation.reports` | `/reports` ✅ | No |
| 14 | Settings | `navigation.settings` | `/settings` ✅ | No |

### 2.2 Verification

| Check | Status |
|-------|--------|
| All section labels use `t('navigation.*')` | ✅ |
| Active state highlighting (current route highlighted) | ✅ |
| Collapsible sections (expand/collapse group) | ✅ |
| No forbidden module links (Finance, HR, Purchasing, Sales, etc.) | ✅ |
| No dead links (all link to existing active routes) | ✅ |
| Icons present for each section | ✅ |

---

## 3. Breadcrumb Gaps

The `getPageTitle()` function in the layout maps routes to breadcrumb labels. Some routes fall back to `dashboard.title` because they are unmapped:

| Unmapped Route | Impact | Priority |
|----------------|--------|----------|
| `spare-parts` | Breadcrumb shows "Dashboard" instead of "Spare Parts" | LOW (cosmetic) |
| `machine-components` | Breadcrumb shows "Dashboard" | LOW (cosmetic) |
| `personnel` | Breadcrumb shows "Dashboard" | LOW (cosmetic) |
| `bom` | Breadcrumb shows "Dashboard" | LOW (cosmetic) |
| `repair-orders` | Breadcrumb shows "Dashboard" | LOW (cosmetic) |
| `installed-parts` | Breadcrumb shows "Dashboard" | LOW (cosmetic) |

These are cosmetic only — the page title still renders via the page's own `title` field using `useTranslation`. Fixing these would require adding 6 route mappings to `getPageTitle()`. No functional impact.

---

## 4. Arabic / RTL

| Element | RTL Support | Status |
|---------|-------------|--------|
| Sidebar | Flips to right side, icons mirrored | ✅ |
| AdminDataGrid | `dir` prop sets text direction | ✅ |
| DataTable | Inherits from shell context | ✅ |
| AdminShell | `dir` from `useTranslation()` | ✅ |
| Topbar | Flips user menu and locale switcher | ✅ |
| Action bar | Buttons align to opposite side | ✅ |

---

## 5. Phase 5 Conclusion

Layout and navigation are consistent and functional across all active pages. The `AdminShell` provides a uniform wrapper with sidebar, topbar, action bar, and footer. Sidebar contains 14 sections, all linked to active routes with i18n labels and no forbidden modules. Breadcrumb gaps exist for 6 routes (cosmetic, LOW priority). RTL support is correctly implemented at both layout and component level. Responsive behavior handles desktop, tablet, and mobile viewports without breakage.
