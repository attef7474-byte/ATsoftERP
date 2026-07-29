# Training Module: Maintenance Operator / مشغل الصيانة

| Field | Value |
|-------|-------|
| Module ID | TRN-MNT-001 |
| Role | Maintenance Operator / مشغل الصيانة |
| Duration | 2 hours |
| Prerequisites | Basic computer skills, knowledge of machines and production equipment |
| Version | 1.0 |
| Date | 2026-07-29 |

## Learning Objectives / أهداف التعلم
- Create corrective and preventive maintenance requests in the system
- View request status and track progress through the Kanban board
- Check assigned tasks and view work instructions
- Log machine downtime with duration, reason, and impact
- Search and filter requests by machine, priority, date, or status
- Understand the request lifecycle from creation to closure

## System Access / صلاحيات النظام
Required permissions:
- `maintenance-requests:create`
- `maintenance-requests:read`
- `maintenance-tasks:read`
- `downtime-logs:create`
- `downtime-logs:read`

## Module Content / محتوى الوحدة

### 1. Creating a Maintenance Request / إنشاء طلب صيانة

**Navigation Path:**
Maintenance → Requests → Create Request (أوامر الصيانة → طلبات الصيانة → إنشاء طلب)

**Step-by-Step Instructions:**
1. Click **Create Request** button (the + icon in the top-right area of the requests list page)
2. Select the **Machine** from the dropdown (use F9 search if the list is long — start typing machine name or code)
3. Set **Priority** — choose from LOW, MEDIUM, HIGH, CRITICAL (the default is MEDIUM)
4. Select **Request Type** — Corrective (عطل), Preventive (دوري), or Improvement (تحسين)
5. Describe the **Problem Description** in clear Arabic text. Be specific: include exact location, sound/behavior, frequency of issue, and when it started
6. Optionally attach images or notes in the **Notes** field
7. Click **Save** — the system auto-generates the request number (e.g., MR-2026-00001) via NumberingService
8. The request appears in **DRAFT** status — you do not need to submit it separately; the supervisor will receive it

**Key Fields:**
| Field | Required | Notes |
|-------|----------|-------|
| Machine | Yes | F9 searchable; filtered to active machines in your branch |
| Priority | Yes | CRITICAL = production stopped, HIGH = imminent stoppage |
| Request Type | Yes | Corrective is the most common for operators |
| Problem Description | Yes | Minimum 3 characters; be specific |
| Notes | No | Internal notes visible to maintenance team only |

**Common Scenarios:**
- **Machine breakdown (CRITICAL):** Select machine, set priority to CRITICAL, type "توقف كامل للماكينة — لا تعمل نهائياً", set request type Corrective. Notify supervisor immediately after saving.
- **Unusual noise (HIGH):** Set priority to HIGH, describe the sound type and location
- **Minor issue (MEDIUM):** Normal priority for non-urgent issues
- **Scheduled inspection (PREVENTIVE):** Only if a PM schedule exists — otherwise the planner creates these

**What the User Should See:**
After saving, a success toast appears. The request appears in the list with status DRAFT and the generated request number visible.

---

### 2. Viewing Request Status and Kanban Board / عرض حالة الطلب ولوحة كانبان

**Navigation Path:**
Maintenance → Requests → Kanban Board (أوامر الصيانة → طلبات الصيانة → عرض كانبان)

**Step-by-Step Instructions:**
1. Navigate to **Kanban Board** from the requests page
2. View the columns — each column represents a status:
   - **DRAFT** — newly created, not yet reviewed
   - **PENDING** — awaiting supervisor approval
   - **APPROVED** — approved and ready for assignment
   - **IN_PROGRESS** — assigned to a technician and work has started
   - **COMPLETED** — work done, awaiting verification
   - **VERIFIED** — supervisor confirmed completion
   - **CANCELLED** — request cancelled
3. Drag and drop is available for authorized users (operators can only view, not move cards)
4. Click any card to see full request details, assigned technician, and activity log
5. Use the filter bar at top to narrow by machine, priority, or date range

**What the User Should See:**
Color-coded Kanban columns with request cards. Each card shows request number, machine name, priority badge (red=CRITICAL, orange=HIGH, yellow=MEDIUM, green=LOW), and elapsed time.

---

### 3. Checking Assigned Tasks and Work Instructions / عرض المهام المسندة

**Navigation Path:**
Dashboard → My Tasks (لوحة التحكم → مهامي)

**Step-by-Step Instructions:**
1. From the main dashboard, locate the **My Tasks** widget
2. View the list of open maintenance requests assigned to you
3. Click a task to see full details and work instructions
4. The task detail page shows:
   - Request number and creation date
   - Machine name and location
   - Problem description
   - Any checklist items if defined
   - Spare parts allocated (if any)
   - Instructions added by supervisor or engineer
5. Update task progress if the system allows — mark as STARTED / IN_PROGRESS / COMPLETED

**What the User Should See:**
A focused list of tasks assigned to the current user, with status badges and due date indicators.

---

### 4. Logging Downtime / تسجيل وقت التوقف

**Navigation Path:**
Maintenance → Downtime Logs → Create Log (أوامر الصيانة → سجلات التوقف → تسجيل توقف)

**Step-by-Step Instructions:**
1. Navigate to **Downtime Logs** under the Maintenance module
2. Click **Create Downtime Log**
3. Select the **Machine** (same F9 search pattern)
4. Enter **Start Date & Time** of the downtime
5. Enter **End Date & Time** when the machine resumed operation
6. Select **Downtime Reason** from the predefined list (e.g., Mechanical Failure, Electrical Failure, Waiting for Spare Part, etc.)
7. Optionally enter the **Maintenance Request Number** if this downtime is linked to an existing request
8. Enter **Production Impact** — estimated lost units or hours
9. Click **Save**

**Key Rules:**
- Duration is auto-calculated from start/end times
- You can log past downtime (up to 7 days back by default)
- Multiple downtime logs can link to the same maintenance request
- Downtime reason is mandatory for accurate reporting

**What the User Should See:**
A form with machine selector, datetime pickers, reason dropdown, and optional request link. After saving, the log appears in the downtime list with calculated duration.

---

## Hands-On Exercise / تمرين عملي

**Scenario:**
You are an operator at生产线 A. Machine "CNC-Lathe-01" has stopped working completely. Production is halted.

**Task:**
1. Create a corrective maintenance request for **CNC-Lathe-01** with priority **HIGH**
2. In the problem description, write: "الماكينة توقفت تماماً عن العمل — لا تستقبل الأوامر من وحدة التحكم"
3. Attach a note: "تم إبلاغ المشرف المناوب"
4. After creating the request, navigate to the **Kanban Board** and verify the request appears in the **DRAFT** column
5. Log a downtime record for the same machine:
   - Start: 08:00 today
   - End: 10:30 today
   - Reason: "Mechanical Failure"
   - Link to the maintenance request number you just created
   - Production impact: "250 قطعة"

**Expected Result:**
- A new request with a generated number in DRAFT status
- A downtime log showing 2.5 hours duration linked to the request

---

## Assessment / تقييم

**Quiz Questions:**

1. What are the four priority levels for a maintenance request?
   - A) LOW, MEDIUM, HIGH, URGENT
   - B) LOW, MEDIUM, HIGH, CRITICAL
   - C) MINOR, MAJOR, CRITICAL, BLOCKER
   - D) LOW, NORMAL, HIGH, URGENT

2. Which status does a newly created maintenance request receive?
   - A) PENDING
   - B) APPROVED
   - C) DRAFT
   - D) IN_PROGRESS

3. An operator can drag-and-drop cards on the Kanban Board?
   - A) True
   - B) False (operators can only view, not move cards)

4. When logging downtime, which field is auto-calculated?
   - A) Start time
   - B) End time
   - C) Duration
   - D) Production impact

5. Which key is used to search for a machine in a long dropdown list?
   - A) F5
   - B) F9
   - C) Ctrl+F
   - D) F12

**Practical Verification:**
- Trainee creates a request in under 3 minutes
- Trainee correctly identifies the status in Kanban
- Trainee logs downtime with correct duration calculation

---

## Quick Reference Card / بطاقة مرجعية سريعة

| Action | Navigation | Key Field(s) |
|--------|-----------|--------------|
| Create request | Maintenance → Requests → Create Request | Machine, Priority, Problem Description |
| View Kanban | Maintenance → Requests → Kanban Board | Filter by machine/status |
| Check my tasks | Dashboard → My Tasks | Status filter |
| Log downtime | Maintenance → Downtime Logs → Create | Machine, Start/End, Reason |
| F9 search | Any machine/part dropdown | Type machine code or name |

- Always set CRITICAL priority if production is stopped
- Problem description must be in Arabic and specific
- Request number is auto-generated — do not enter manually
- Downtime duration is calculated from start and end times
- Kanban statuses: DRAFT → PENDING → APPROVED → IN_PROGRESS → COMPLETED → VERIFIED → CANCELLED