# Defect Register

## Known Issues / Limitations

### 1. Browser Screenshots Not Captured
- **Priority**: Low
- **Description**: Screenshots could not be taken because the agent does not have browser automation capabilities. User needs to manually verify visual rendering.
- **Workaround**: Manual visual inspection of each page in Arabic and English modes.
- **Status**: Open — documented in browser-proof.md

### 2. Column Visibility (Show/Hide Columns) Not Implemented
- **Priority**: Medium
- **Description**: The requirements mention optional column visibility toggling with localStorage persistence. This was documented as a future enhancement due to complexity.
- **Status**: Future enhancement

### 3. Excel-Like Column Filter Menus Not Implemented
- **Priority**: Medium
- **Description**: Full filter menus (with checkboxes, operators, etc.) not in scope. Simple filter row with inputs/selects implemented instead.
- **Status**: Per spec, acceptable for first pass

### 4. Old DataTable Still Used on Some Pages
- **Priority**: Low
- **Description**: Not all pages were migrated to AdminDataGrid. Approximately 30+ pages still use the old DataTable. These are lower-priority pages (reports, barcodes, some maintenance).
- **Workaround**: Gradual migration in future phases.
- **Status**: Documented in pages-updated.md

### 5. Runtime Not Tested End-to-End
- **Priority**: Low
- **Description**: The Web server was not running during validation. API build passed but runtime behavior (API calls, modals, navigation) not verified in this session.
- **Workaround**: User should start both servers and test manually.
- **Status**: Open

### 6. No Permission-Based Action Hiding
- **Priority**: Medium
- **Description**: Actions can be disabled via `enabled: false` but there is no automatic permission-checking integration. Each page must manually control action enabled states.
- **Status**: As-designed, follows existing pattern

### 7. Grid Does Not Support Editable Cells
- **Priority**: Low
- **Description**: The grid is display-only. Inline editing is not supported.
- **Status**: Not required for current scope
