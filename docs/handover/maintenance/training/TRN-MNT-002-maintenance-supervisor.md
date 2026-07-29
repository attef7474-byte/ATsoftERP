# Training Module: Maintenance Supervisor / مشرف الصيانة

| Field | Value |
|-------|-------|
| Module ID | TRN-MNT-002 |
| Role | Maintenance Supervisor / مشرف الصيانة |
| Duration | 3 hours |
| Prerequisites | TRN-MNT-001 (Maintenance Operator) |
| Version | 1.0 |
| Date | 2026-07-29 |

## Learning Objectives / أهداف التعلم
- Review and approve/reject incoming maintenance requests
- Assign technicians to approved requests (personnel assignment + responsibility assignment)
- Monitor team workload using the calendar workload view
- Verify completed work and close requests
- Generate maintenance reports and KPIs
- Configure SLA rules and monitor compliance
- Manage request reassignments when technicians are unavailable

## System Access / صلاحيات النظام
Required permissions:
- `maintenance-requests:read`
- `maintenance-requests:approve`
- `maintenance-requests:assign`
- `maintenance-requests:verify`
- `maintenance-personnel:read`
- `maintenance-responsibility-assignments:manage`
- `maintenance-sla:read`
- `maintenance-sla:manage`
- `maintenance-calendar-workload:read`
- `maintenance-reports:read`
- `maintenance-dashboard:read`
- `audit:read`

## Module Content / محتوى الوحدة

### 1. Dashboard Overview and Request Pipeline / نظرة عامة على لوحة التحكم وخط سير الطلبات

**Navigation Path:**
Maintenance → Dashboard (أوامر الصيانة → لوحة التحكم)

**Step-by-Step Instructions:**
1. Navigate to the **Maintenance Dashboard** — this is your command center
2. Review the summary widgets:
   - **Pending Requests** — requests awaiting your review
   - **In Progress** — tasks currently assigned to technicians
   - **Completed Today** — requests finished today awaiting verification
   - **Overdue Tasks** — tasks past their SLA deadline
   - **Downtime Today** — total downtime hours logged today
3. View the **Requests by Status** chart for a quick visual of the pipeline
4. View the **Workload Distribution** chart to see how tasks are spread across technicians
5. Click any widget number to drill down into the underlying requests list

**What the User Should See:**
A dashboard with 5-6 widget cards at the top, two charts in the middle, and a recent activity feed at the bottom. Color-coded indicators (red for overdue, green for on-track).

---

### 2. Request Approval Workflow / سير عمل الموافقة على الطلبات

**Navigation Path:**
Maintenance → Requests → Pending Approval (أوامر الصيانة → طلبات الصيانة → المعلقة)

**Step-by-Step Instructions:**
1. Navigate to **Pending Approval** — this shows all requests in DRAFT status
2. Click a request to view full details:
   - Machine, problem description, priority
   - Operator who created it
   - Creation timestamp and elapsed waiting time
3. Review the problem description — verify it is clear and actionable
4. Take one of these actions:
   - **Approve** — changes status to APPROVED, making it available for assignment
   - **Reject** — changes status to CANCELLED, requires a rejection reason
   - **Request More Info** — sends the request back to the operator with a comment
5. For CRITICAL/HIGH priority requests, approve within 15 minutes (SLA target)
6. For MEDIUM/LOW priority, review within 2 hours

**Approval Guidelines:**
- CRITICAL: Approve immediately, notify technicians via phone
- HIGH: Approve within 15 minutes, assign within 30 minutes
- MEDIUM: Review within 2 hours
- LOW: Review within 8 hours
- Reject only if the request is duplicate, unclear, or out of scope

**What the User Should See:**
A list of pending requests with priority badges and elapsed time. Clicking a request opens a detail panel with Approve/Reject/Request Info buttons.

---

### 3. Assignment Management / إدارة التعيين

**Navigation Path:**
Maintenance → Requests → Assign (أوامر الصيانة → طلبات الصيانة → تعيين)

**Two Assignment Methods:**

#### 3.1 Personnel Assignment / تعيين الأفراد
1. From an approved request, click **Assign Personnel**
2. Select a **Technician** from the personnel list (filtered to available technicians)
3. Set **Expected Duration** in hours
4. Add **Work Instructions** (optional but recommended)
5. Click **Assign** — the request moves to IN_PROGRESS status
6. The technician sees the task in their My Tasks widget

#### 3.2 Responsibility Assignment / تعيين المسؤولية
1. Navigate to **Maintenance → Setup → Responsibility Assignments**
2. Create rules that auto-assign requests based on machine, priority, or shift
3. Example: "All CNC machines CRITICAL requests → Senior Technician Ahmed"
4. These rules trigger automatically when a request is approved

**Key Fields:**
| Field | Required | Notes |
|-------|----------|-------|
| Technician | Yes | Shows only active personnel with matching skills |
| Expected Duration | Yes | Used for workload calculation |
| Work Instructions | No | Visible to technician in task view |
| Priority Override | No | Can escalate if needed |

**What the User Should See:**
A technician selection dialog with availability indicators (green=available, yellow=busy, red=overloaded). After assignment, the request moves to IN_PROGRESS and the technician receives a notification.

---

### 4. Workload Monitoring and Calendar View / مراقبة عبء العمل وعرض التقويم

**Navigation Path:**
Maintenance → Calendar → Workload View (أوامر الصيانة → التقويم → عرض عبء العمل)

**Step-by-Step Instructions:**
1. Navigate to **Calendar Workload View**
2. View the weekly/monthly grid showing each technician's assigned tasks
3. Color codes: green = lightly loaded, yellow = moderate, red = overloaded
4. Drag and drop tasks to reassign between technicians
5. Click a task to see details without leaving the calendar
6. Use the filter to show only specific teams or shifts

**What the User Should See:**
A calendar grid with technicians on rows and time on columns. Blocked time slots represent tasks with duration. Overloaded technicians appear with red backgrounds.

---

### 5. Verification and Closure / التحقق والإغلاق

**Navigation Path:**
Maintenance → Requests → Completed → Verify (أوامر الصيانة → طلبات الصيانة → المنجزة → تحقق)

**Step-by-Step Instructions:**
1. Navigate to the **Completed** tab — shows requests marked COMPLETED by technicians
2. Review the work summary provided by the technician
3. Check that:
   - All checklist items are completed (if applicable)
   - Spare parts consumed match what was issued
   - Downtime was logged
   - No follow-up work is needed
4. Take one of these actions:
   - **Verify** — changes status to VERIFIED, closes the request
   - **Reopen** — sends the request back to IN_PROGRESS with a comment
   - **Request Revision** — requires technician to redo part of the work
5. Verified requests appear in maintenance reports

**What the User Should See:**
A completed request detail with technician notes, parts consumed, and checklist results. Verify/Reopen/Request Revision buttons at the bottom.

---

### 6. Report Generation and KPIs / إنشاء التقارير ومؤشرات الأداء

**Navigation Path:**
Maintenance → Reports → Cost/KPI Reports (أوامر الصيانة → التقارير → تقارير التكلفة/مؤشرات الأداء)

**Step-by-Step Instructions:**
1. Navigate to **Maintenance Reports**
2. Choose report type:
   - **Cost Report** — labor + parts cost per request/machine/period
   - **KPI Dashboard** — MTBF, MTTR, downtime %, request volume
   - **Reliability Report** — machine reliability trends
3. Set date range and filter by machine/department
4. Click **Generate** — report appears in the preview pane
5. Click **Export** to download as PDF, Excel, or CSV
6. Reports respect the current organization context (branch/company)

**Key KPIs:**
| KPI | Definition | Target |
|-----|-----------|--------|
| MTBF | Mean Time Between Failures (hours) | > 500 hrs |
| MTTR | Mean Time To Repair (hours) | < 4 hrs |
| Downtime % | Downtime hours / Total available hours | < 5% |
| PM Compliance | PM tasks completed on time / Total PM tasks | > 90% |
| Cost per Request | Total maintenance cost / Number of requests | Varies by machine |

**What the User Should See:**
A report preview with charts and tables, export buttons in the top-right. KPIs displayed with green/yellow/red threshold indicators.

---

## Hands-On Exercise / تمرين عملي

**Scenario:**
It is Monday morning. You have 5 pending maintenance requests in the system.

**Task:**
1. Navigate to the **Maintenance Dashboard** and verify the number of pending requests
2. Open the **Pending Approval** list — you should see 5 requests
3. Review each request and take the following actions:
   - **Approve Request #1** (CRITICAL, CNC-Lathe-01, "توقف كامل") — this is urgent
   - **Approve Request #2** (HIGH, Conveyor-03, "اهتزاز غير طبيعي") — assign to Technician "Ahmed"
   - **Approve Request #3** (MEDIUM, Pump-07, "تسرب زيت بسيط") — assign to Technician "Sara"
   - **Reject Request #4** (LOW, "نظافة عامة" — not a maintenance issue) — reason: "هذا طلب نظافة وليس صيانة"
   - **Request More Info** on Request #5 (description unclear)
4. After approvals, navigate to **Calendar Workload View** and confirm Ahmed and Sara have their tasks
5. Generate a **KPI Dashboard** report for this week and note the MTTR value

**Expected Result:**
- 2 requests approved and assigned
- 1 request rejected with reason
- 1 request sent back for clarification
- Calendar shows tasks assigned to the correct technicians
- KPI report generated MTBF/MTTR values visible

---

## Assessment / تقييم

**Quiz Questions:**

1. What is the SLA target for approving a CRITICAL priority request?
   - A) 5 minutes
   - B) 15 minutes
   - C) 1 hour
   - D) 2 hours

2. When a supervisor assigns a technician, the request moves to which status?
   - A) APPROVED
   - B) ASSIGNED
   - C) IN_PROGRESS
   - D) COMPLETED

3. What does the red color indicate on the Calendar Workload View?
   - A) Technician is on leave
   - B) Technician is overloaded
   - C) Task is completed
   - D) Task is unassigned

4. Which of the following is NOT a possible supervisor action on a completed request?
   - A) Verify
   - B) Reopen
   - C) Delete
   - D) Request Revision

5. What does MTBF stand for?
   - A) Mean Time Between Failures
   - B) Maximum Time Before Failure
   - C) Minimum Time Between Fixes
   - D) Measured Time Before Fault

**Practical Verification:**
- Trainee approves/rejects requests correctly based on priority
- Trainee assigns technicians and verifies workload calendar updates
- Trainee generates a report with correct filters

---

## Quick Reference Card / بطاقة مرجعية سريعة

| Action | Navigation | Key Field(s) |
|--------|-----------|--------------|
| Approve requests | Maintenance → Requests → Pending Approval | Select request → Approve |
| Assign technician | From approved request → Assign Personnel | Technician, Expected Duration |
| Monitor workload | Maintenance → Calendar → Workload View | Weekly/monthly grid |
| Verify completion | Maintenance → Requests → Completed → Verify | Review → Verify/Reopen |
| Generate reports | Maintenance → Reports → Cost/KPI | Date range, machine filter |
| SLA rules | Maintenance → Setup → SLA Rules | Priority, response time, resolution time |

- CRITICAL requests: approve within 15 minutes
- Rejected requests must have a reason
- Overdue tasks are highlighted in red on the dashboard
- Work instructions help technicians do the job correctly the first time
- Verify work promptly — completed requests are counted in MTTR calculations
- Calendar drag-drop allows quick reassignment without opening each request