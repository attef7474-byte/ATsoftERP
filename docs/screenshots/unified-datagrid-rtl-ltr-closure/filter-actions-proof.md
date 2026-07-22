# Filter and Actions Proof

## Grid Filter Behavior
AdminDataGrid provides a toggleable filter row:
1. Click "Filter" button in toolbar
2. Filter row appears below header
3. Each filterable column shows an input or select
4. Type/select a value → triggers onFilter callback
5. Active filters show a blue dot indicator on the Filter button
6. "Clear" button resets all filters

### Filter Types Supported
- text: text input with placeholder "..."
- select: dropdown with predefined options
- number: number input

### Pages With Per-Column Filters
- Number Sequences: code, operationName (select), prefix, suffix, resetPolicy (select), scope (select), status (select)
- Notification Rules: code, nameEn, eventType (select), channel (select), severity (select), enabled (select)
- Audit Log: action (select), entity (select)
- Products: code, name, unit, status (select)
- Warehouses: code, name, status (select)
- Movements: movementNumber, movementType (select), status (select)
- Balances: productCode, productName

### External Filter Controls
Pages like Audit Log also have external filter controls (action, entity, user, date range) that operate at the API level. These work alongside the grid's built-in filters.

## Row Actions Behavior
Each row has a three-dot (⋮) button that opens a dropdown menu.

### Actions Per Page
- Number Sequences: Edit, View
- Notification Rules: Edit, Delete
- Products: View Details, Edit
- Warehouses: Edit
- Movements: View Details, Edit, Post, Cancel

### Action States
- enabled: true (default) — action is clickable
- enabled: false — action is grayed out, not clickable
- variant: 'danger' — red text styling for delete/destructive actions

### Dropdown Behavior
- Click ⋮ → menu opens
- Click outside → menu closes
- Click action → menu closes, action executes
- Menu positioned relative to the button (left for RTL, right for LTR)

## Search Behavior
Global search bar at the top of the grid. Typing triggers onGlobalSearch callback which updates the page state. The search value is passed to the API via params.
