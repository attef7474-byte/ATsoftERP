# Training Module: System Administrator / مسؤول النظام

| Field | Value |
|-------|-------|
| Module ID | TRN-MNT-008 |
| Role | System Administrator / مسؤول النظام |
| Duration | 3 hours |
| Prerequisites | All previous modules (TRN-MNT-001 through TRN-MNT-007) |
| Version | 1.0 |
| Date | 2026-07-29 |

## Learning Objectives / أهداف التعلم
- Configure global maintenance settings (operation types, cost centers, production lines)
- Manage numbering sequences for all maintenance entity types
- Create and assign roles and permissions for maintenance users
- Manage user accounts (create, edit, deactivate)
- Review audit logs for maintenance activities
- Maintain i18n keys for maintenance-related UI text and API messages
- Perform system health checks and verify configuration integrity

## System Access / صلاحيات النظام
Required permissions:
- `system-settings:manage`
- `numbering:manage`
- `roles:manage`
- `permissions:manage`
- `users:manage`
- `audit:read`
- `i18n:manage`
- All maintenance read permissions

## Module Content / محتوى الوحدة

### 1. Maintenance Settings Configuration / تكوين إعدادات الصيانة

**Navigation Path:**
Settings → Maintenance Settings (الإعدادات → إعدادات الصيانة)

#### 1.1 Operation Types / أنواع العمليات
1. Navigate to **Settings → Maintenance Settings → Operation Types**
2. View the predefined operation types:
   - Corrective Maintenance
   - Preventive Maintenance
   - Improvement
   - Inspection
   - Calibration
   - Overhaul
3. Add a new operation type:
   - Click **Add Operation Type**
   - Enter **Code** (e.g., "EMERGENCY_REPAIR")
   - Enter **Name (Arabic)** and **Name (English)**
   - Select **Color** for Kanban board (hex code)
   - Click **Save**
4. Operation types are used in maintenance request forms and reports

#### 1.2 Cost Centers / مراكز التكلفة
1. Navigate to **Settings → Maintenance Settings → Cost Centers**
2. View the list of existing cost centers
3. Create a new cost center:
   - Click **Add Cost Center**
   - Enter **Code** (e.g., "CC-MNT-001")
   - Enter **Name (Arabic)** and **Name (English)**
   - Optionally link to a **Department**
   - Set **Budget Limit** (optional, for cost control)
   - Click **Save**
4. Cost centers are assigned to machines and used in cost reports

#### 1.3 Production Lines / خطوط الإنتاج
1. Navigate to **Settings → Maintenance Settings → Production Lines**
2. View existing production lines
3. Create a new production line:
   - Click **Add Production Line**
   - Enter **Code** and **Name**
   - Select **Department**
   - Add machines to the line (multi-select)
   - Click **Save**
4. Production lines group machines for reporting and workload planning

#### 1.4 General Maintenance Settings / الإعدادات العامة للصيانة
1. Navigate to **Settings → Maintenance Settings → General**
2. Configure:
   - **Default Priority** for new requests
   - **Auto-approve Requests** toggle (if enabled, requests skip supervisor approval)
   - **Downtime Auto-Link** — automatically link downtime logs to requests
   - **PM Task Generation Lead Time** — how far in advance PM tasks are generated
   - **Overdue Threshold** — days after which a request is considered overdue
   - **Default Warehouse** for spare part issues
3. Click **Save**

**What the User Should See:**
A settings page with multiple tabs/sections. Each section has a data grid and an add/edit form.

---

### 2. Numbering Sequence Management / إدارة تسلسل الترقيم

**Navigation Path:**
Settings → Numbering → Sequences (الإعدادات → الترقيم → التسلسلات)

**Step-by-Step Instructions:**
1. Navigate to **Numbering Sequences**
2. View the list of all entity types — the following are relevant for maintenance:
   | Entity Type | Code | Active |
   |-------------|------|--------|
   | Maintenance Request | MAINTENANCE_REQUEST | Yes |
   | Maintenance Task | MAINTENANCE_TASK | Yes |
   | Preventive Maintenance | PREVENTIVE_MAINTENANCE | Yes |
   | Downtime Log | DOWNTIME | Yes |
   | Stock Issue | STOCK_ISSUE | Yes |
   | Spare Part Replacement | SPARE_PART_REPLACEMENT | Yes |
   | Repair Order | SPARE_PART_REPAIR_ORDER | Yes |
   | Machine Asset | MACHINE_ASSET | Yes |
   | Machine Document | MACHINE_DOCUMENT | Yes |
3. Click any sequence to edit:
   - **Prefix** — e.g., "MR-" for maintenance requests, "RO-" for repair orders
   - **Starting Number** — initial counter value
   - **Current Number** — read-only, shows current counter position
   - **Last Generated Code** — read-only, shows the last code issued
   - **Pad Length** — zero-padding length (e.g., 5 → "00001")
   - **Status** — ACTIVE or DISABLED
4. To create a new sequence:
   - Click **Add Sequence**
   - Select **Entity Type** from dropdown (system-defined)
   - Enter **Prefix**
   - Set **Starting Number** (default: 1)
   - Set **Pad Length**
   - Status: ACTIVE
   - Click **Save**
5. **Important Rules:**
   - Never manually edit CurrentNumber — the NumberingService manages this atomically
   - Disable a sequence (set status to DISABLED) instead of deleting it
   - The prefix + number format is fixed after first use (e.g., MR-2026-00001)
   - Preview shows the next number without consuming it

**What the User Should See:**
A data grid of all numbering sequences. Clicking a row opens an edit panel with prefix, current number (read-only), pad length, and status fields.

---

### 3. Role and Permission Management / إدارة الأدوار والصلاحيات

**Navigation Path:**
Settings → Access Control → Roles (الإعدادات → التحكم بالوصول → الأدوار)

**Step-by-Step Instructions:**
1. Navigate to **Roles**
2. View existing roles (e.g., Admin, Maintenance Supervisor, Maintenance Engineer, Store Keeper, Operator)
3. Create a new role:
   - Click **Add Role**
   - Enter **Name (Arabic)** and **Name (English)**
   - Enter **Description**
   - Click **Save**
4. Assign permissions to the role:
   - Open the role detail page
   - Navigate to the **Permissions** tab
   - Browse or search for permissions by module:
     - **Maintenance** — all maintenance-related permissions
     - **Inventory** — stock issue and balance permissions
     - **System** — numbering, settings, i18n
     - **Audit** — audit log access
   - Check the boxes for required permissions
   - Click **Save**

**Key Maintenance Permissions:**
| Permission Key | Description | Module |
|---------------|-------------|--------|
| `maintenance-requests:create` | Create new requests | Maintenance |
| `maintenance-requests:approve` | Approve/reject requests | Maintenance |
| `maintenance-requests:assign` | Assign technicians | Maintenance |
| `maintenance-requests:verify` | Verify completed work | Maintenance |
| `repair-orders:create` | Create repair orders | Maintenance |
| `repair-orders:manage` | Manage repair lifecycle | Maintenance |
| `repair-orders:complete` | Complete repair orders | Maintenance |
| `repair-orders:scrap` | Scrap unrepairable parts | Maintenance |
| `preventive-maintenance:manage` | Manage PM schedules | Maintenance |
| `bom:manage` | Manage BOMs | Maintenance |
| `spare-parts:manage` | Manage spare part catalog | Maintenance |

5. Assign the role to users in the **Users** section

**What the User Should See:**
A role list with user count. Role detail has a permissions tree grouped by module, with checkboxes.

---

### 4. User Account Management / إدارة حسابات المستخدمين

**Navigation Path:**
Settings → Users (الإعدادات → المستخدمين)

**Step-by-Step Instructions:**
1. Navigate to **Users**
2. View the list of all users
3. Create a new user:
   - Click **Add User**
   - Enter **Full Name (Arabic)** and **Full Name (English)**
   - Enter **Email Address** (used for login)
   - Enter **Phone Number**
   - Select **Branch**
   - Select **Department**
   - Select **Role(s)** — one or more roles
   - Set **Status** — ACTIVE or INACTIVE
   - Leave **Password** — system sends a setup email, or set an initial password
   - Click **Save**
4. Edit an existing user:
   - Click the user row
   - Update fields as needed
   - To reset password: Click **Reset Password** → system generates a reset link
   - To deactivate: Set Status to INACTIVE
5. **Best Practices:**
   - Each user should have the minimum permissions needed for their role
   - Deactivate, don't delete users (to preserve audit trail)
   - Review user permissions quarterly
   - Operators should only have `maintenance-requests:create` and `downtime-logs:create`

**What the User Should See:**
A data grid of users with name, email, role, branch, and status. Click to edit. Add button in the top bar.

---

### 5. Audit Log Review / مراجعة سجل التدقيق

**Navigation Path:**
Settings → Audit Log (الإعدادات → سجل التدقيق)

**Step-by-Step Instructions:**
1. Navigate to **Audit Log**
2. View a chronological list of all system changes
3. Filter by:
   - **Date Range** — select specific period
   - **Entity Type** — e.g., MaintenanceRequest, RepairOrder, BOM, User
   - **Action** — CREATE, UPDATE, DELETE, STATUS_CHANGE, APPROVE, REJECT
   - **User** — who performed the action
   - **Entity ID** — specific record number
4. Click any log entry to view **Details**:
   - Timestamp
   - User (name + email)
   - Entity type and ID
   - Action performed
   - Before/after values (JSON diff for changes)
   - IP address (if tracked)
5. **Key Things to Monitor in Maintenance:**
   - Frequent status changes on the same request (possible inefficiency)
   - Stock issues with large quantities (investigate if unusual)
   - Repair order scrapping (track scrap rate)
   - Role/permission changes (security)
   - Numbering sequence edits (should be rare)

**What the User Should See:**
A searchable, filterable data grid with columns: Timestamp, User, Action, Entity Type, Entity ID. Detail panel shows the full JSON diff.

---

### 6. i18n Key Management for Maintenance / إدارة مفاتيح الترجمة للصيانة

**Navigation Path:**
Settings → i18n → Maintenance (الإعدادات → الترجمة → الصيانة)

**Step-by-Step Instructions:**
1. Navigate to **i18n Management**
2. Select the **Maintenance** domain
3. View all translation keys with Arabic and English values
4. Edit a key:
   - Click a key row
   - Modify the Arabic or English value
   - Click **Save**
5. Add a new key:
   - Click **Add Key**
   - Enter **Key Name** (follow convention: `maintenance.<section>.<descriptive-name>`)
   - Enter **English Value**
   - Enter **Arabic Value**
   - Select **Domain** (maintenance, api-messages, etc.)
   - Click **Save**
6. Use **Search** to find specific keys

**Naming Convention:**
```
maintenance.requests.create.success → "تم إنشاء طلب الصيانة بنجاح"
maintenance.requests.approve.success → "تمت الموافقة على الطلب"
maintenance.repair-orders.inspection.complete → "اكتمل الفحص — القطعة قابلة للإصلاح"
```

**Important Rules:**
- Every API error message must have both EN and AR keys
- Keys must be stable — do not rename keys that are in use
- Frontend keys must match between EN and AR files
- Use placeholders `{variable}` for dynamic content

**What the User Should See:**
A data grid with key, English value, and Arabic value columns. Inline editing for quick updates.

---

### 7. System Health Verification / التحقق من سلامة النظام

**Navigation Path:**
Settings → System Health (الإعدادات → سلامة النظام)

**Step-by-Step Instructions:**
1. Navigate to **System Health**
2. View health status for:
   - **API** — check if the API server is running and responsive
   - **Database** — check database connectivity
   - **Numbering Service** — verify all sequences are consistent
   - **Audit Service** — verify audit logging is active
3. Click **Run Health Check** to trigger a fresh check
4. Review any warnings or errors and take corrective action

**Common Health Checks for Maintenance:**
| Check | What It Verifies | If Fails |
|-------|-----------------|----------|
| Numbering sequence consistency | All sequences have valid current numbers | Reset corrupted sequences |
| BOM version integrity | Each machine has exactly 1 active BOM | Deactivate extra active BOMs |
| Condition balance sum | SERVICEABLE + DEFECTIVE + UNDER_REPAIR + SCRAPPED = total InventoryBalance | Run reconciliation |
| Permission integrity | All maintenance endpoints have permission checks | Add missing permission guards |

**What the User Should See:**
A dashboard with green/red indicators for each health check. Details show the last check timestamp and any error messages.

---

## Hands-On Exercise / تمرين عملي

**Scenario:**
The company is setting up maintenance for a new branch. You need to configure the system.

**Task:**
1. **Create a new numbering sequence** for maintenance requests:
   - Entity Type: Maintenance Request
   - Prefix: "MR-2026-"
   - Starting Number: 1
   - Pad Length: 4
   - Status: ACTIVE
2. **Create a role** called "Maintenance Supervisor - New Branch":
   - Permissions:
     - `maintenance-requests:read`
     - `maintenance-requests:approve`
     - `maintenance-requests:assign`
     - `maintenance-requests:verify`
     - `maintenance-personnel:read`
     - `maintenance-reports:read`
     - `maintenance-dashboard:read`
3. **Create a user** for the new role:
   - Name: "أحمد محمد"
   - Email: "ahmed.newbranch@atsofterp.com"
   - Branch: The new branch
   - Role: "Maintenance Supervisor - New Branch"
   - Status: ACTIVE
4. **Add a new operation type**:
   - Code: "EMERGENCY"
   - Name EN: "Emergency Repair"
   - Name AR: "إصلاح طارئ"
   - Color: "#FF0000"
5. **Review the audit log** for any recent changes to numbering sequences
6. **Run a system health check** and verify all maintenance-related checks pass

**Expected Result:**
- New numbering sequence created with prefix "MR-2026-"
- Role created with 7 permissions assigned
- User created with the new role
- Operation type "Emergency Repair" added
- Audit log shows no unauthorized numbering changes
- System health check passes for all maintenance checks

---

## Assessment / تقييم

**Quiz Questions:**

1. What should you do instead of deleting a numbering sequence?
   - A) Leave it as is
   - B) Set status to DISABLED
   - C) Reset the counter to zero
   - D) Change the prefix

2. Which permission allows a user to verify completed maintenance work?
   - A) `maintenance-requests:approve`
   - B) `maintenance-requests:assign`
   - C) `maintenance-requests:verify`
   - D) `maintenance-requests:create`

3. When creating a user, what should you do instead of deleting a user who leaves the company?
   - A) Delete the user
   - B) Set status to INACTIVE
   - C) Remove all permissions
   - D) Change their email

4. What does the audit log show when you click a log entry?
   - A) Only the timestamp
   - B) Full JSON diff with before/after values
   - C) The user's password
   - D) Only the entity type

5. Which naming convention should i18n keys for maintenance follow?
   - A) `maintenance.<section>.<descriptive-name>`
   - B) `<random-description>`
   - C) `mnt_<number>`
   - D) `<module>_<key>`

**Practical Verification:**
- Trainee creates a numbering sequence with correct format
- Trainee creates a role with accurate permission set
- Trainee creates a user and assigns the role
- Trainee finds an audit log entry by filter
- Trainee runs a health check and interprets results

---

## Quick Reference Card / بطاقة مرجعية سريعة

| Action | Navigation | Key Field(s) |
|--------|-----------|--------------|
| Operation types | Settings → Maintenance → Operation Types | Code, Name (EN/AR), Color |
| Cost centers | Settings → Maintenance → Cost Centers | Code, Name, Budget Limit |
| Numbering sequences | Settings → Numbering → Sequences | Prefix, Start Number, Pad Length |
| Roles & permissions | Settings → Access Control → Roles | Name, Permission checkboxes |
| Users | Settings → Users | Name, Email, Branch, Role |
| Audit log | Settings → Audit Log | Date range, Entity, User filter |
| i18n keys | Settings → i18n → Maintenance | Key, EN value, AR value |
| System health | Settings → System Health | Run health check |

- Never manually edit CurrentNumber in numbering sequences
- Disable sequences instead of deleting them
- Deactivate users instead of deleting them
- Audit log is immutable — data cannot be edited or deleted
- i18n keys must be stable — renaming breaks existing UI references
- Minimum permissions principle: give users only what they need
- All maintenance modules use the NumberingService — never edit counters directly
- API error messages must have both EN and AR translation keys
- System health check should be run weekly to catch configuration drift