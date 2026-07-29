# Training Module: Maintenance Engineer / مهندس الصيانة

| Field | Value |
|-------|-------|
| Module ID | TRN-MNT-003 |
| Role | Maintenance Engineer / مهندس الصيانة |
| Duration | 4 hours |
| Prerequisites | TRN-MNT-001, TRN-MNT-002 |
| Version | 1.0 |
| Date | 2026-07-29 |

## Learning Objectives / أهداف التعلم
- Manage the machine catalog including categories, components, and spare part mappings
- Create and version Bill of Materials (BOM) for each machine
- Configure Preventive Maintenance (PM) schedules with frequency and task templates
- Assign cost centers to machines and requests
- Manage the spare part catalog with technical classifications
- Perform reliability analysis using MTBF/MTTR data
- Define operation types and production lines

## System Access / صلاحيات النظام
Required permissions:
- `machine-categories:manage`
- `machine-components:manage`
- `machine-spare-parts:manage`
- `spare-parts:manage`
- `bom:manage`
- `preventive-maintenance:manage`
- `operation-types:manage`
- `production-lines:manage`
- `cost-centers:manage`
- `maintenance-reliability:read`
- `maintenance-dashboard:read`
- `audit:read`

## Module Content / محتوى الوحدة

### 1. Machine Catalog Management / إدارة كتالوج الماكينات

**Navigation Path:**
Maintenance → Setup → Machines → Catalog (أوامر الصيانة → الإعدادات → الماكينات → الكتالوج)

#### 1.1 Machine Categories / فئات الماكينات
1. Navigate to **Machine Categories**
2. View the tree structure of categories (e.g., CNC → Lathe → CNC-Lathe-01)
3. Create a new category:
   - Click **Add Category**
   - Enter **Name (Arabic)** and **Name (English)**
   - Select **Parent Category** if this is a subcategory
   - Click **Save**
4. Categories are used to filter and group machines in reports and Kanban

#### 1.2 Machine Components / مكونات الماكينة
1. Navigate to a specific machine → **Components** tab
2. View the list of components (e.g., Spindle, Coolant Pump, Control Unit)
3. Add a component:
   - Click **Add Component**
   - Enter component name, code, and optional serial number
   - Select component type (Mechanical, Electrical, Hydraulic, Pneumatic, Electronic)
   - Click **Save**
4. Components are used in BOMs and repair action logs

#### 1.3 Spare Parts Mapping / ربط قطع الغيار
1. Navigate to a specific machine → **Spare Parts** tab
2. Map spare parts to this machine:
   - Click **Link Spare Part**
   - Search for the spare part by code or name
   - Set **Minimum Stock Level** for this machine
   - Click **Save**
3. Mapped spare parts appear in the preventive spare part planning UI

**What the User Should See:**
A tabbed interface on the machine detail page: General info, Components, Spare Parts, Documents. Each tab has an add/edit/delete data grid.

---

### 2. BOM Creation and Versioning / إنشاء قائمة المكونات وإدارة الإصدارات

**Navigation Path:**
Maintenance → BOM → Create (أوامر الصيانة → قائمة المكونات → إنشاء)

**Step-by-Step Instructions:**
1. Navigate to **BOM Management**
2. Click **Create BOM**
3. Select the **Machine** from the dropdown
4. Enter **BOM Name** and **Description**
5. Set **Version** — start with 1.0
6. Add components and spare parts:
   - Click **Add Row**
   - Select a **Component** of the machine
   - Select a **Spare Part** from the catalog
   - Enter **Quantity** required per component
   - Enter **Unit of Measure** (e.g., pcs, meters, liters)
   - Optionally add a **Reference Designator** (e.g., "M1-SPINDLE-BEARING")
   - Repeat for each line item
7. Click **Save** — the BOM is created in DRAFT status
8. To activate: click **Activate Version** — the previous active version is auto-archived

**Versioning Rules:**
- Only one version can be ACTIVE at a time
- Active version is used by PM spare part planning
- Previous versions remain in the system as history
- Version changes trigger an audit event
- Draft versions are not used in any automated process

**Common Scenario — BOM Update:**
When a spare part is replaced with an alternative:
1. Open the active BOM
2. Click **Create New Version** — copies current version as DRAFT
3. Edit the spare part line
4. Increment version number (e.g., from 1.0 to 1.1 or 2.0)
5. Activate the new version

**What the User Should See:**
A BOM editor with a dynamic table. Each row has component dropdown, spare part dropdown, quantity, and UOM. A version history panel on the right shows all versions with active/draft status badges.

---

### 3. Preventive Maintenance Schedule Configuration / إعداد جدول الصيانة الوقائية

**Navigation Path:**
Maintenance → Preventive Maintenance → Schedules (أوامر الصيانة → الصيانة الوقائية → الجداول)

**Step-by-Step Instructions:**
1. Navigate to **PM Schedules**
2. Click **Create Schedule**
3. Select the **Machine**
4. Choose **Frequency**:
   - **Daily** — every N days
   - **Weekly** — specific day(s) of week
   - **Monthly** — specific day of month
   - **Quarterly** — every 3 months
   - **Yearly** — once per year
   - **Meter-Based** — every N operating hours/cycles
5. Set **Start Date** and optional **End Date** (leave blank for ongoing)
6. Select or create a **Task Template** — a predefined list of inspection/repair items
7. Assign **Default Technician** or leave unassigned for supervisor to assign
8. Configure **Reminder** — send notification N days before due
9. Click **Save**

**Task Template Creation:**
1. From the PM Schedule form, click **Manage Templates** or navigate to Maintenance → Setup → PM Templates
2. Click **Create Template**
3. Enter template name
4. Add checklist items:
   - Task description (e.g., "Check hydraulic oil level")
   - Expected duration (minutes)
   - Required spare parts (optional link)
5. Save template

**What the User Should See:**
A schedule form with frequency pattern selector. When saved, the schedule appears in a calendar view with auto-generated PM tasks on their due dates.

---

### 4. Cost Center Assignment / تعيين مركز التكلفة

**Navigation Path:**
Maintenance → Setup → Cost Centers (أوامر الصيانة → الإعدادات → مراكز التكلفة)

**Step-by-Step Instructions:**
1. Navigate to **Cost Centers**
2. View the list of cost centers (pre-seeded or created by admin)
3. Create a new cost center:
   - Click **Add Cost Center**
   - Enter **Code** and **Name (Arabic/English)**
   - Select **Department** (optional filter)
   - Click **Save**
4. Assign cost center to a machine:
   - Open machine detail → **General** tab
   - Select **Cost Center** from dropdown
   - Click **Save**
5. Cost centers flow into maintenance cost reports automatically

**What the User Should See:**
A data grid of cost centers with code, name, and department. Machine detail page shows cost center as a read-write field.

---

### 5. Spare Part Catalog Management / إدارة كتالوج قطع الغيار

**Navigation Path:**
Maintenance → Spare Parts → Catalog (أوامر الصيانة → قطع الغيار → الكتالوج)

**Step-by-Step Instructions:**
1. Navigate to **Spare Parts Catalog**
2. Search for existing spare parts by code, name, or technical classification
3. Create a new spare part:
   - Click **Add Spare Part**
   - Enter **Code** (follow naming convention, e.g., "SP-CNC-001")
   - Enter **Name (Arabic)** and **Name (English)**
   - Select **Technical Classification** (e.g., Bearing, Seal, Motor, Pump, Electronic)
   - Select **Usage Type** (Consumable, Repairable, Critical, Non-Critical)
   - Select **Importance** (Low, Medium, High, Critical)
   - Set **Minimum Stock Level** and **Maximum Stock Level**
   - Set **Unit of Measure** (pcs, meters, liters, kg)
   - Link to **Product** if this spare part is also an inventory product
   - Click **Save**
4. The spare part now appears in:
   - Machine mapping dropdowns
   - BOM line item selection
   - Stock issue requests
   - Repair order workflows

**Technical Classification Fields:**
| Field | Purpose | Example |
|-------|---------|---------|
| technicalClassification | Grouping for reporting | "Bearing", "Motor", "Seal" |
| usageType | Determines workflow | Consumable = one-time use, Repairable = can go through repair order |
| importance | Priority for stock | Critical = must always be in stock |
| minimumStockLevel | Auto-reorder trigger | 5 units |

**What the User Should See:**
A searchable/filterable data grid of spare parts with all classification columns. The creation form includes dropdowns for classification fields and a product lookup.

---

### 6. Reliability Analysis / تحليل الموثوقية

**Navigation Path:**
Maintenance → Reports → Reliability (أوامر الصيانة → التقارير → الموثوقية)

**Step-by-Step Instructions:**
1. Navigate to **Reliability Report**
2. Select a **Machine** or machine group
3. Set **Date Range**
4. Click **Generate** — the system calculates:
   - **MTBF** = Total operating hours / Number of failures
   - **MTTR** = Total repair hours / Number of repairs
   - **Availability %** = (Total time - Downtime) / Total time × 100
   - **Failure Frequency** = Failures per month
5. View trend charts — MTBF over time, top failure causes, most downtime-prone components
6. Export to PDF for management review

**What the User Should See:**
A report with calculated metrics displayed as cards, trend line charts for MTBF/MTTR over time, and a table of failure events with root causes.

---

## Hands-On Exercise / تمرين عملي

**Scenario:**
You are a maintenance engineer setting up a new machine "CNC-Mill-02" that has arrived at the factory.

**Task:**
1. Create a **BOM** for CNC-Mill-02 with version **1.0**:
   - Component: "Spindle Unit" → Spare Part: "Spindle Bearing Set" × 2 pcs
   - Component: "Coolant System" → Spare Part: "Coolant Pump" × 1 pc
   - Component: "Control Panel" → Spare Part: "Control Board V3" × 1 pc
   - Component: "Control Panel" → Spare Part: "Fuse 10A" × 4 pcs
   - Component: "Lubrication System" → Spare Part: "Oil Filter" × 1 pc
2. **Activate** Version 1.0 of the BOM
3. Create a **Monthly PM Schedule** for CNC-Mill-02 starting next month
   - Use a task template called "Standard Monthly Inspection"
   - Assign to default technician "Ahmed"
4. Verify the spare part "Spindle Bearing Set" is mapped to CNC-Mill-02
5. Generate a **Reliability Report** for the last 3 months for all CNC machines

**Expected Result:**
- BOM with 5 line items across 4 components, version 1.0 ACTIVE
- PM schedule set to monthly, starting on the 1st of next month
- Spare part mapping confirmed for the machine
- Reliability report showing MTBF/MTTR for CNC machines

---

## Assessment / تقييم

**Quiz Questions:**

1. How many BOM versions can be ACTIVE at the same time for one machine?
   - A) 1
   - B) 2
   - C) Unlimited
   - D) 0 (BOMs don't have versions)

2. Which PM frequency type is based on machine usage rather than calendar?
   - A) Daily
   - B) Weekly
   - C) Monthly
   - D) Meter-Based

3. What happens to the previous active BOM version when a new version is activated?
   - A) It is deleted
   - B) It is archived as history
   - C) It remains active
   - D) It is moved to a different machine

4. Which spare part field determines if a part can go through the repair workflow?
   - A) technicalClassification
   - B) importance
   - C) usageType
   - D) minimumStockLevel

5. MTBF is calculated as:
   - A) Total failures / Total operating hours
   - B) Total operating hours / Number of failures
   - C) Total repair hours / Number of repairs
   - D) Total downtime / Total time

**Practical Verification:**
- Trainee creates a BOM with correct component/part mapping
- Trainee activates the version and verifies it appears as active
- Trainee creates a PM schedule with correct frequency
- Trainee locates a spare part in the catalog by classification filter

---

## Quick Reference Card / بطاقة مرجعية سريعة

| Action | Navigation | Key Field(s) |
|--------|-----------|--------------|
| Create BOM | Maintenance → BOM → Create | Machine, Component, Spare Part, Quantity |
| Activate version | BOM detail → Activate Version | Version number |
| Create PM schedule | Maintenance → Preventive → Schedules | Machine, Frequency, Task Template |
| Manage spare parts | Maintenance → Spare Parts → Catalog | Code, Name, Classification, Stock Levels |
| Manage cost centers | Maintenance → Setup → Cost Centers | Code, Name |
| Reliability report | Maintenance → Reports → Reliability | Machine, Date Range |

- Only one BOM version active per machine
- PM frequencies: Daily, Weekly, Monthly, Quarterly, Yearly, Meter-Based
- Spare part usageType = Repairable enables repair order workflow
- Cost centers auto-link to maintenance cost reports
- MTBF target: > 500 hours; MTTR target: < 4 hours
- BOM changes always create a new version — never edit an active BOM directly