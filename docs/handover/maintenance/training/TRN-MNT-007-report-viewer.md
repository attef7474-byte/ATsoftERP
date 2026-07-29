# Training Module: Report Viewer / مستعرض التقارير

| Field | Value |
|-------|-------|
| Module ID | TRN-MNT-007 |
| Role | Report Viewer / مستعرض التقارير |
| Duration | 1.5 hours |
| Prerequisites | None |
| Version | 1.0 |
| Date | 2026-07-29 |

## Learning Objectives / أهداف التعلم
- Access and navigate the maintenance reports section
- Generate cost reports filtered by date range, machine, and department
- Interpret KPI dashboard metrics (MTBF, MTTR, downtime percentage)
- View reliability metrics and failure trend analysis
- Access installed parts register and replacement history reports
- Export reports to PDF, Excel, and CSV formats
- Understand report filters and their impact on data

## System Access / صلاحيات النظام
Required permissions:
- `maintenance-reports:read`
- `maintenance-dashboard:read`
- `maintenance-reliability:read`
- `installed-parts:read`
- `spare-part-replacement-history:read`
- `audit:read`

## Module Content / محتوى الوحدة

### 1. Report Types Overview / نظرة عامة على أنواع التقارير

**Navigation Path:**
Maintenance → Reports (أوامر الصيانة → التقارير)

The system provides these maintenance report types:

| Report | Purpose | Best For |
|--------|---------|----------|
| **Cost Report** | Labor + parts cost per request/machine/period | Budget tracking, cost analysis |
| **KPI Dashboard** | MTBF, MTTR, downtime %, request volume | Performance monitoring |
| **Reliability Report** | Failure trends, top failure causes, component reliability | Engineering analysis |
| **PM Compliance Report** | Scheduled vs completed PM tasks | Planning effectiveness |
| **Installed Parts Register** | Current installed parts on each machine | Asset tracking |
| **Replacement History** | History of spare part replacements | Failure pattern analysis |
| **Downtime Analysis** | Downtime by reason, machine, duration | Root cause analysis |
| **Audit Log** | All maintenance-related changes | Compliance and traceability |

**What the User Should See:**
Reports page with a grid of report type cards or tabs. Each type has a description and typical use case.

---

### 2. Generating a Cost Report / إنشاء تقرير التكلفة

**Navigation Path:**
Maintenance → Reports → Cost Report (أوامر الصيانة → التقارير → تقرير التكلفة)

**Step-by-Step Instructions:**
1. Navigate to **Cost Report**
2. Set **Date Range**:
   - Preset options: Today, This Week, This Month, Last Month, This Quarter, This Year, Custom
   - Custom: select start and end dates using the date picker
3. Apply **Filters**:
   - **Machine** — select one or multiple machines (leave blank for all)
   - **Department** — filter by department
   - **Request Type** — Corrective, Preventive, or All
   - **Cost Type** — Labor, Parts, or Total
4. Click **Generate**
5. Report displays:
   - **Summary Section:** Total cost, number of requests, average cost per request
   - **Breakdown Table:** Request number, machine, type, labor cost, parts cost, total cost
   - **Chart:** Bar chart of cost by machine (top 10)
6. **Interpret the Results:**
   - Identify machines with highest maintenance cost
   - Compare labor vs parts cost ratio
   - Review cost trends month-over-month

**What the User Should See:**
A filter panel on the left/top and a report preview on the right. After generation, summary cards and a data table appear with a chart.

---

### 3. KPI Dashboard and Reliability Metrics / لوحة مؤشرات الأداء ومقاييس الموثوقية

**Navigation Path:**
Maintenance → Reports → KPI Dashboard (أوامر الصيانة → التقارير → لوحة مؤشرات الأداء)

**Step-by-Step Instructions:**
1. Navigate to **KPI Dashboard**
2. Set **Date Range** (required)
3. Optionally filter by **Machine Group**
4. Click **Generate**
5. The dashboard displays:

**Key Metrics:**
| Metric | Formula | What It Tells You |
|--------|---------|-------------------|
| **MTBF** | Total operating hours / Number of failures | Average time between breakdowns — higher is better |
| **MTTR** | Total repair hours / Number of repairs | Average time to fix — lower is better |
| **Availability %** | (Total time - Downtime) / Total time × 100 | Percentage of time machine was available — higher is better |
| **Downtime %** | Downtime hours / Total available hours × 100 | Percentage of time lost to downtime — lower is better |
| **Request Volume** | Total requests in period | Workload volume indicator |
| **PM Compliance %** | PM completed on time / Total PM × 100 | How well PM schedule is followed |

**Interpreting Trends:**
- **MTBF decreasing** → machines are aging, may need overhaul or replacement
- **MTTR increasing** → technicians need training, or spare parts are harder to get
- **Availability dropping** → investigate top downtime causes
- **PM compliance low** → review workload balance, too many corrective tasks

**What the User Should See:**
A dashboard with metric cards showing current values with trend arrows (up/down) and color indicators (green=good, yellow=warning, red=bad). Below the cards, trend line charts for MTBF and MTTR over time.

---

### 4. Installed Parts Register / سجل القطع المثبتة

**Navigation Path:**
Maintenance → Reports → Installed Parts Register (أوامر الصيانة → التقارير → سجل القطع المثبتة)

**Step-by-Step Instructions:**
1. Navigate to **Installed Parts Register**
2. Filter by:
   - **Machine** — select specific machine
   - **Spare Part** — select specific spare part
   - **Installation Date Range** — when parts were installed
3. Click **Generate**
4. Report shows:
   - Machine name and code
   - Installed spare part with serial number
   - Installation date and request number
   - Installed quantity
   - Current status (Active / Replaced)
   - Technician who installed
5. Click any row to view the **replacement history** for that part

**Use Cases:**
- Track which batch of parts is installed on each machine
- Identify when a specific part was installed (for warranty tracking)
- Verify part authenticity and traceability

**What the User Should See:**
A data grid with machine and part columns. Each row represents one installed part instance. Filtered results update in real-time.

---

### 5. Replacement History Report / تقرير سجل الاستبدال

**Navigation Path:**
Maintenance → Reports → Replacement History (أوامر الصيانة → التقارير → سجل الاستبدال)

**Step-by-Step Instructions:**
1. Navigate to **Replacement History**
2. Set filters:
   - **Machine** — specific machine or all
   - **Component** — specific component
   - **Spare Part** — specific part
   - **Date Range**
   - **Replacement Reason** — Wear, Failure, Upgrade, etc.
3. Click **Generate**
4. Report shows:
   - Replacement date and request number
   - Machine and component
   - Old part (removed) — code, serial, condition
   - New part (installed) — code, serial
   - Reason for replacement
   - Technician
   - Cost of replaced part
5. **Export** to Excel for further analysis

**Use Cases:**
- Identify frequently replaced parts (potential quality issue)
- Track replacement patterns by component
- Calculate total replacement cost per machine

**What the User Should See:**
A data grid with old/new part comparison columns. Each row is one replacement event with full traceability.

---

### 6. Exporting Reports / تصدير التقارير

**Step-by-Step Instructions:**
1. After generating any report, locate the **Export** button (top-right of report area)
2. Select export format:
   - **PDF** — for presentation and printing
   - **Excel (XLSX)** — for data analysis
   - **CSV** — for import into other systems
3. Click the format
4. The file downloads automatically
5. PDF includes:
   - Report title and generation timestamp
   - Filter criteria displayed
   - All charts and tables formatted for printing
   - Page numbers and date

**Note:** Reports respect the current organization context (branch/company). If you switch branches, reports will show different data.

**What the User Should See:**
A download dialog or browser download notification. PDF files open with proper formatting and layout.

---

## Hands-On Exercise / تمرين عملي

**Scenario:**
The maintenance manager has asked for a cost analysis of last month's maintenance activities.

**Task:**
1. Navigate to **Maintenance → Reports → Cost Report**
2. Set **Date Range** to "Last Month"
3. Set **Machine** filter to "CNC-Lathe-01"
4. Click **Generate**
5. Review the report and identify:
   - Total cost for CNC-Lathe-01
   - Number of requests
   - Average cost per request
   - Labor vs parts cost split
6. **Export** the report to PDF
7. Now navigate to **KPI Dashboard**:
   - Set date range to last month
   - Set machine group to "All CNC Machines"
   - Generate and note the MTBF and MTTR values
8. Navigate to **Replacement History**:
   - Filter by machine: CNC-Lathe-01
   - Find the top 3 most frequently replaced spare parts

**Expected Result:**
- Cost report PDF downloaded showing total cost and breakdown
- KPI dashboard showing MTBF and MTTR for CNC group
- Top 3 frequently replaced parts identified for CNC-Lathe-01

---

## Assessment / تقييم

**Quiz Questions:**

1. Which metric measures the average time between machine breakdowns?
   - A) MTTR
   - B) MTBF
   - C) Availability %
   - D) Downtime %

2. What does an increasing MTTR trend indicate?
   - A) Machines are becoming more reliable
   - B) Repairs are taking longer (potential training or parts issue)
   - C) PM compliance is improving
   - D) Request volume is decreasing

3. Which report would you use to track which spare parts are currently installed on a machine?
   - A) Cost Report
   - B) KPI Dashboard
   - C) Installed Parts Register
   - D) Downtime Analysis

4. What export formats are available for reports?
   - A) PDF only
   - B) Excel only
   - C) PDF, Excel (XLSX), and CSV
   - D) PDF and Word only

5. The Availability % formula is:
   - A) (Total time - Downtime) / Total time × 100
   - B) Downtime / Total time × 100
   - C) MTBF / (MTBF + MTTR) × 100
   - D) Both A and C are valid

**Practical Verification:**
- Trainee generates a cost report with correct filters
- Trainee exports report to PDF
- Trainee interprets KPI metrics correctly
- Trainee uses filters effectively to narrow down data

---

## Quick Reference Card / بطاقة مرجعية سريعة

| Report | Navigation | Key Filters | Best Use |
|--------|-----------|-------------|----------|
| Cost Report | Reports → Cost Report | Date Range, Machine | Budget tracking |
| KPI Dashboard | Reports → KPI Dashboard | Date Range, Machine Group | Performance monitoring |
| Reliability Report | Reports → Reliability | Machine, Date Range | Engineering analysis |
| Installed Parts Register | Reports → Installed Parts | Machine, Part | Asset tracking |
| Replacement History | Reports → Replacement History | Machine, Component, Reason | Failure pattern analysis |
| PM Compliance | Reports → PM Compliance | Date Range, Department | Planning effectiveness |

| Metric | Target | Meaning |
|--------|--------|---------|
| MTBF | > 500 hours | Time between failures |
| MTTR | < 4 hours | Time to repair |
| Availability | > 95% | Machine uptime |
| Downtime % | < 5% | Time lost |
| PM Compliance | > 90% | Schedule adherence |

- Use date range presets for quick reports (This Month, Last Month)
- Filter by machine to isolate specific asset costs
- Export PDF for management, Excel for analysis
- Reports respect current branch/company context
- KPI trends are more important than single values
- Top cost drivers = machines with highest total cost
- Frequently replaced parts may indicate quality issues