# Training Module: Maintenance Planner / مخطط الصيانة

| Field | Value |
|-------|-------|
| Module ID | TRN-MNT-006 |
| Role | Maintenance Planner / مخطط الصيانة |
| Duration | 3 hours |
| Prerequisites | TRN-MNT-002 (Maintenance Supervisor), TRN-MNT-003 (Maintenance Engineer) |
| Version | 1.0 |
| Date | 2026-07-29 |

## Learning Objectives / أهداف التعلم
- Create and manage Preventive Maintenance (PM) schedules with various frequency types
- Generate preventive spare part plans by linking BOM and PM schedules
- Calculate required spare part quantities for upcoming PM tasks
- Manage workload calendar and balance team capacity
- Configure and monitor SLA rules for maintenance response times
- Analyze PM compliance and schedule adherence

## System Access / صلاحيات النظام
Required permissions:
- `preventive-maintenance:manage`
- `preventive-maintenance:read`
- `bom:read`
- `spare-parts:read`
- `machine-spare-parts:read`
- `maintenance-calendar-workload:manage`
- `maintenance-sla:manage`
- `maintenance-reports:read`
- `maintenance-dashboard:read`

## Module Content / محتوى الوحدة

### 1. PM Schedule Management / إدارة جداول الصيانة الوقائية

**Navigation Path:**
Maintenance → Preventive Maintenance → Schedules (أوامر الصيانة → الصيانة الوقائية → الجداول)

#### 1.1 Creating a PM Schedule / إنشاء جدول صيانة وقائية
1. Navigate to **PM Schedules**
2. Click **Create Schedule**
3. Select the **Machine** (F9 search for long lists)
4. Enter **Schedule Name** (e.g., "الصيانة الشهرية لآلة CNC-Mill-02")
5. Select **Frequency Type**:
   | Type | Configuration | Example |
   |------|--------------|---------|
   | Daily | Every N days | Every 7 days (weekly basis) |
   | Weekly | Day(s) of week | Every Monday and Thursday |
   | Monthly | Day of month (1-31) | 1st of every month |
   | Quarterly | Every N months | Every 3 months |
   | Yearly | Specific date | Every January 15 |
   | Meter-Based | Every N operating hours | Every 500 hours |
6. Set **Start Date** — the first scheduled PM date
7. Set **End Date** — leave blank for ongoing (no end date)
8. Select a **Task Template** — predefined checklist of PM activities
   - Or create a new template inline if none exists
9. Assign **Default Technician** (optional — supervisor can reassign)
10. Set **Reminder Days** — how many days before due to notify
11. Click **Save**

#### 1.2 Editing a PM Schedule / تعديل جدول صيانة وقائية
1. Open an existing schedule
2. Modify frequency, dates, or template
3. Click **Save**
4. **Important:** Editing a schedule does NOT retroactively change already-generated PM tasks; it only affects future task generation

#### 1.3 Viewing PM Calendar / عرض تقويم الصيانة الوقائية
1. Navigate to **Preventive Maintenance → Calendar**
2. View all PM tasks in a monthly/weekly calendar
3. Color-coded:
   - Green = completed on time
   - Yellow = due soon (within 3 days)
   - Red = overdue
   - Gray = upcoming (more than 3 days away)
4. Click a task to mark as completed or reschedule

**What the User Should See:**
A calendar grid showing PM tasks on their scheduled dates. Clicking a task opens a detail panel with the task template checklist.

---

### 2. Preventive Spare Part Planning / تخطيط قطع الغيار للصيانة الوقائية

**Navigation Path:**
Maintenance → Preventive Maintenance → Spare Part Plans (أوامر الصيانة → الصيانة الوقائية → خطط قطع الغيار)

**Step-by-Step Instructions:**
1. Navigate to **Spare Part Plans**
2. Click **Create Plan**
3. Select a **PM Schedule** from the list
4. The system loads the **Active BOM** for the machine linked to this schedule
5. Review the BOM line items — each shows:
   - Component name
   - Spare part code and name
   - Quantity per BOM
6. For each spare part, set:
   - **Replace Every N Cycles** — how many PM cycles between replacements (e.g., replace oil filter every 1 cycle, replace belt every 3 cycles)
   - **Safety Stock Quantity** — extra buffer
7. The system calculates **Required Quantity** per PM task:
   - Formula: (BOM quantity × Replace Every N Cycles factor) + Safety Stock
8. Click **Save**

**Example Calculation:**
| Spare Part | BOM Qty | Replace Every | Safety Stock | Required per PM |
|-----------|---------|--------------|-------------|----------------|
| Oil Filter | 1 pc | 1 cycle | 0 | 1 pc |
| Belt | 2 pcs | 3 cycles | 1 | 1 pc (2/3 rounded up + 1) |
| Bearing Set | 1 set | 6 cycles | 1 | 1 set (every 6th cycle) |

**Important Notes:**
- Plans respect the ACTIVE BOM version at the time of calculation
- If BOM version changes, the planner must **Recalculate** the plan
- Plans can be run in **Preview Mode** to see quantities without consuming inventory

**What the User Should See:**
A plan creation page with a table loaded from the BOM. Each row has editable Replace Every and Safety Stock columns with calculated Required Quantity.

---

### 3. Workload Calendar Management / إدارة تقويم عبء العمل

**Navigation Path:**
Maintenance → Calendar → Workload View (أوامر الصيانة → التقويم → عرض عبء العمل)

**Step-by-Step Instructions:**
1. Navigate to **Calendar Workload View**
2. View the weekly/monthly grid:
   - Rows = technicians
   - Columns = days
   - Cells = assigned tasks with time blocks
3. Review **Workload Balance**:
   - Green = under 70% capacity
   - Yellow = 70–90% capacity
   - Red = over 90% capacity
4. Reassign tasks by dragging from one technician to another
5. Reschedule tasks by dragging to a different date
6. Use the **Auto-Balance** feature (if available) to distribute tasks evenly

**Planning Tips:**
- Reserve 70% of capacity for PM tasks
- Leave 30% buffer for corrective/emergency requests
- Review workload weekly and adjust PM schedules if needed
- Account for technician leave and holidays

**What the User Should See:**
An interactive calendar grid with drag-and-drop support. Color-coded capacity indicators at the top of each technician's column.

---

### 4. SLA Configuration and Monitoring / تكوين ومراقبة اتفاقيات مستوى الخدمة

**Navigation Path:**
Maintenance → Setup → SLA Rules (أوامر الصيانة → الإعدادات → قواعد SLA)

**Step-by-Step Instructions:**
1. Navigate to **SLA Rules**
2. Click **Add SLA Rule**
3. Configure the rule:
   - **Priority** — which priority level this rule applies to
   - **Response Time (hours)** — max time from request creation to first action
   - **Resolution Time (hours)** — max time from assignment to completion
   - **Escalation** — notify supervisor if SLA is breached
4. Click **Save**
5. Repeat for each priority level

**Default SLA Targets:**
| Priority | Response Time | Resolution Time |
|----------|--------------|-----------------|
| CRITICAL | 15 minutes | 4 hours |
| HIGH | 30 minutes | 8 hours |
| MEDIUM | 2 hours | 24 hours |
| LOW | 8 hours | 72 hours |

**Monitoring SLA Compliance:**
1. Navigate to **Maintenance → Dashboard**
2. View the **SLA Compliance %** widget
3. Click to drill down into breached requests
4. Review each breached request and take corrective action

**What the User Should See:**
SLA rules grid with priority, response time, and resolution time columns. Dashboard widget shows overall compliance percentage.

---

### 5. PM Compliance Reporting / تقارير الالتزام بالصيانة الوقائية

**Navigation Path:**
Maintenance → Reports → PM Compliance (أوامر الصيانة → التقارير → الالتزام بالصيانة الوقائية)

**Step-by-Step Instructions:**
1. Navigate to **PM Compliance Report**
2. Select **Date Range** (monthly, quarterly, yearly)
3. Filter by **Machine Group** or **Department**
4. Click **Generate**
5. Report shows:
   - **Scheduled PMs** — total tasks scheduled
   - **Completed on Time** — tasks completed before or on due date
   - **Completed Late** — tasks completed after due date
   - **Overdue / Missed** — tasks not completed past due date
   - **PM Compliance %** = Completed on Time / Scheduled × 100
6. Export to PDF or Excel

**Target:**
- PM Compliance should be > 90%
- If below 90%, review workload balance and schedule realism

**What the User Should See:**
A report with summary cards at top, a bar chart showing monthly PM compliance trends, and a table of overdue tasks.

---

## Hands-On Exercise / تمرين عملي

**Scenario:**
You are a maintenance planner setting up preventive maintenance for "CNC-Mill-02". The machine has an active BOM version 1.0.

**Task:**
1. **Create a Monthly PM Schedule** for CNC-Mill-02:
   - Name: "الصيانة الشهرية CNC-Mill-02"
   - Frequency: Monthly on day 1
   - Start Date: 1st of next month
   - No end date (ongoing)
   - Task Template: "Standard Monthly Inspection" (create this if it doesn't exist):
     - "Check hydraulic oil level" — 15 min
     - "Inspect spindle bearings" — 30 min
     - "Clean coolant filters" — 20 min
     - "Check electrical connections" — 15 min
     - "Lubricate guide rails" — 20 min
   - Default Technician: "Ahmed"
   - Reminder: 2 days before
2. **Create a Preventive Spare Part Plan** linked to this schedule:
   - Review the BOM for CNC-Mill-02
   - Configure:
     - Oil Filter: Replace every 1 cycle, Safety Stock 0
     - Spindle Bearing Set: Replace every 6 cycles, Safety Stock 1
     - Coolant Pump: Replace every 12 cycles, Safety Stock 0
   - Save the plan
3. **Verify** the plan calculates correct quantities
4. Navigate to **Workload Calendar** and confirm the PM task appears on the 1st of next month for Ahmed

**Expected Result:**
- PM schedule created with monthly frequency
- Task template with 5 checklist items
- Spare part plan linked to schedule with calculated quantities
- Calendar shows the PM task on the correct date assigned to Ahmed

---

## Assessment / تقييم

**Quiz Questions:**

1. Which frequency type is NOT a calendar-based PM frequency?
   - A) Daily
   - B) Weekly
   - C) Meter-Based
   - D) Monthly

2. What is the recommended capacity buffer left for corrective/emergency requests?
   - A) 10%
   - B) 30%
   - C) 50%
   - D) 70%

3. What happens when you edit an existing PM schedule?
   - A) All past PM tasks are updated
   - B) Only future PM tasks are affected
   - C) The schedule is deleted and recreated
   - D) Nothing changes

4. The PM Compliance target is:
   - A) > 80%
   - B) > 90%
   - C) > 95%
   - D) 100%

5. When creating a spare part plan, what does "Replace Every N Cycles" mean?
   - A) Replace the part every N days
   - B) Replace the part every N PM cycles
   - C) Replace the part N times per cycle
   - D) Replace the part after N hours of operation

**Practical Verification:**
- Trainee creates a PM schedule with correct frequency
- Trainee builds a task template with proper checklist items
- Trainee links a spare part plan with correct calculation
- Trainee verifies calendar shows the task

---

## Quick Reference Card / بطاقة مرجعية سريعة

| Action | Navigation | Key Field(s) |
|--------|-----------|--------------|
| Create PM schedule | Maintenance → Preventive → Schedules → Create | Machine, Frequency, Task Template |
| Create task template | From schedule form → Manage Templates | Task items, durations |
| Create spare part plan | Maintenance → Preventive → Spare Part Plans | PM Schedule, BOM, Replace Cycle |
| View workload calendar | Maintenance → Calendar → Workload View | Drag-drop to reassign |
| SLA rules | Maintenance → Setup → SLA Rules | Priority, Response Time, Resolution Time |
| PM compliance report | Maintenance → Reports → PM Compliance | Date range, machine filter |

- Frequencies: Daily, Weekly, Monthly, Quarterly, Yearly, Meter-Based
- Reserve 70% capacity for PM, 30% for corrective work
- PM compliance target: > 90%
- Spare part plan respects ACTIVE BOM version — recalculate after BOM changes
- Editing schedules only affects future tasks
- SLA: CRITICAL = 15 min response, 4 hr resolution
- Calendar color codes: Green (done), Yellow (due soon), Red (overdue), Gray (upcoming)