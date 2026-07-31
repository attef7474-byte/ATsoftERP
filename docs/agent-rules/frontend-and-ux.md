# Frontend and UX Rules

## 1. Next.js App Router Conventions

* Use the established App Router patterns: `page.tsx` server components for initial data where applicable, client components for interactivity, `useParams`/`useRouter` for navigation.
* Keep the established admin layout, sidebar, and navigation patterns. Do not create a second competing UI pattern without explicit approval.

## 2. Reuse Existing Components

Reuse the project's shared components:

* Error modal / Global Error Dialog (`useApiErrorHandler`).
* Toasts (`showToast`).
* Unified F9 lookup and search adapters.
* Admin action bar patterns (`useRegisterAdminActions`).
* Data-grid patterns (`AdminDataGrid`, `entity-data-table`).
* Entity workspace components (`components/entity/`).
* Operational-context components.

Do not create parallel implementations of these patterns.

## 3. Real API Flows

* Every frontend operation must use the real backend API.
* `POST` for creation; established `PATCH /:id` pattern for updating the same record.
* Edit pages must fetch the existing record and map it into the form — editing must never create a new record.
* Real list, real details, real create, real edit, real delete/deactivate where allowed.

## 4. Minimal-Input Forms and Auto-Population

* Enter information once, reuse it everywhere safely.
* Operational forms must request only values that cannot be derived reliably.
* Automatically populate: active company, active branch, current user, current employee, current shift, facility, area, section, line, machine, component, operation type, cost center, warehouse, product unit, document number, initial status, date/time, related request/order, existing defaults, responsibility assignments.
* Selecting a machine should populate its hierarchy and defaults; selecting a source document should populate known source data.
* Cascading selections: choosing a company constrains branches, choosing a branch constrains departments/warehouses, choosing a line constrains machines.
* Do not auto-populate stale data from a previously opened unrelated record.
* Sensitive overrides require permission and audit; a reason may be required.

## 5. States

Every operational page must include, where applicable:

* Loading state.
* Empty state (only for genuinely empty results — distinguish "not yet loaded" from "empty").
* Error state (via `useApiErrorHandler` / Global Error Dialog).
* Permission state (hide or explain actions the user cannot perform).
* Disabled-state explanation.
* Success feedback.
* Search, filtering, pagination/virtualization for large datasets.
* Clear current status and allowed next actions.
* Audit/history access and attachments where operationally relevant.

## 6. Editing Behavior

* Editing loads the same existing record and prefills all editable fields.
* The record identity must be preserved (no duplicate creation on edit).
* Preserve entered data when a recoverable API error occurs.
* Prevent duplicate submissions; disable action buttons while requests are running.

## 7. Arabic/English and RTL/LTR

* Every user-facing feature supports Arabic and English with matching translation keys in both locales; key sets must stay synchronized.
* Never hard-code user-facing text; never return raw translation keys to the user.
* Arabic must be tested in RTL, English in LTR — verify form alignment, table alignment, modal direction, icons, numbers, dates, pagination, side panels, print layouts, export labels, error messages, empty states, status labels, action labels.

## 8. Accessibility

* Use semantic HTML, accessible labels (`aria-label` on icon-only buttons), keyboard navigation, and focus management for modals/drawers.
* Esc key closes modals and drawers; overlay click closes side sheets on mobile.

## 9. Responsive Grids and Detail Views

* Master-table + opposite-side detail drawer pattern is the established workspace pattern (see `components/entity/entity-detail-drawer.tsx`).
* The drawer must render above all fixed headers (portal to `document.body` with the established z-index layering: overlay z-80, panel z-90).
* Provide a visible close button with a translated accessible label.

## 10. Duplicate-Submit Prevention and Stale State

* Prevent duplicate submissions; disable action buttons while requests are running.
* Section data hooks must clear data on entity change and discard out-of-order responses (see `use-drawer-section-data.ts`).
* Do not display system-generated IDs as user-facing values when readable names or codes exist.

## 11. No Raw Keys or IDs

* All user-visible strings come from translation keys.
* Entity references display readable names/codes, not raw internal IDs.
