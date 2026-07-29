# Training Module: Repair Technician / فني الإصلاح

| Field | Value |
|-------|-------|
| Module ID | TRN-MNT-005 |
| Role | Repair Technician / فني الإصلاح |
| Duration | 3 hours |
| Prerequisites | TRN-MNT-004 (Store Keeper) |
| Version | 1.0 |
| Date | 2026-07-29 |

## Learning Objectives / أهداف التعلم
- Create repair orders from returned defective spare parts
- Navigate the repair order lifecycle through all statuses
- Record repair actions including parts consumed and labor hours
- Manage condition balance transitions at each lifecycle stage
- Scrap unrepairable parts correctly
- Understand the duplicate guard (preventing duplicate repair orders for the same returned part)

## System Access / صلاحيات النظام
Required permissions:
- `repair-orders:read`
- `repair-orders:create`
- `repair-orders:manage`
- `repair-orders:complete`
- `repair-orders:scrap`
- `repair-actions:read`
- `repair-actions:create`
- `spare-part-condition-balance:read`

## Module Content / محتوى الوحدة

### 1. Repair Order Lifecycle Overview / نظرة عامة على دورة حياة أمر الإصلاح

The repair order progresses through these statuses:

```
DRAFT → OPEN → IN_INSPECTION → APPROVED_FOR_REPAIR → UNDER_REPAIR → UNDER_TEST → COMPLETED_SERVICEABLE
                                                                                  → SCRAPPED (from any status)
```

| Status | Meaning | Condition Effect |
|--------|---------|-----------------|
| DRAFT | Newly created, not yet started | None (condition unchanged) |
| OPEN | Ready for workshop | None |
| IN_INSPECTION | Technician is diagnosing | DEFECTIVE → UNDER_REPAIR |
| APPROVED_FOR_REPAIR | Inspection complete, repair approved | None (already UNDER_REPAIR) |
| UNDER_REPAIR | Active repair work | None |
| UNDER_TEST | Testing after repair | None |
| COMPLETED_SERVICEABLE | Repair successful | UNDER_REPAIR → SERVICEABLE |
| SCRAPPED | Part cannot be repaired | UNDER_REPAIR → SCRAPPED; InventoryBalance decreases |

**Duplicate Guard:**
The system prevents creating a repair order that duplicates an existing one for the same:
- `replacementHistoryId` (if linked to a replacement event)
- `sourceType` + `sourceId` combination (cannot create two repair orders from the same returned part)

---

### 2. Creating a Repair Order from a Returned Part / إنشاء أمر إصلاح من قطعة مرتجعة

**Navigation Path:**
Maintenance → Repair Orders → Create (أوامر الصيانة → أوامر الإصلاح → إنشاء)

**Step-by-Step Instructions:**
1. Navigate to **Repair Orders**
2. Click **Create Repair Order**
3. The system auto-generates the repair order number via NumberingService
4. Select **Source Type** — choose "RETURN" (from returned defective part)
5. Select **Source** — search for the returned part transaction or the original stock issue
6. Select the **Spare Part** being repaired
7. Enter **Quantity** (typically 1 for serialized parts, can be more for bulk)
8. Select **Received Condition** — should be DEFECTIVE
9. Enter **Received From** — the technician who returned the part
10. Add **Fault Description** — describe the reported fault in detail
11. Click **Save** — status is DRAFT

**Alternative Creation Path:**
From the Installed Parts register or Replacement History:
- If a part was replaced and the old part is marked as repairable, the system offers a **Create Repair Order** button
- Clicking it pre-fills all fields from the replacement data

**What the User Should See:**
A creation form with source type selector, spare part lookup, fault description textarea, and auto-generated order number.

---

### 3. Performing Inspection / إجراء الفحص

**Navigation Path:**
Open a repair order → Click **Start Inspection** (أمر الإصلاح → بدء الفحص)

**Step-by-Step Instructions:**
1. Open the repair order from the list (filter by DRAFT or OPEN)
2. Click **Start Inspection** — status changes to IN_INSPECTION
3. **Condition balance effect:** DEFECTIVE decreases by quantity, UNDER_REPAIR increases by quantity
4. Inspect the part physically:
   - Check for visible damage
   - Test with appropriate equipment
   - Document findings
5. In the system, record inspection results:
   - **Inspection Notes** — describe what you found
   - **Repairable?** — Yes / No
6. Click **Complete Inspection**:
   - If repairable → status changes to APPROVED_FOR_REPAIR
   - If not repairable → prompts for scrapping

**What the User Should See:**
Inspection form within the repair order detail. Notes field and a Repairable toggle. After completing inspection, the status badge updates.

---

### 4. Performing Repair Actions / تنفيذ أعمال الإصلاح

**Navigation Path:**
Repair order detail → Actions tab → Add Action (تفاصيل أمر الإصلاح → الإجراءات → إضافة إجراء)

**Step-by-Step Instructions:**
1. From the repair order (status must be UNDER_REPAIR), navigate to the **Actions** tab
2. Click **Add Repair Action**
3. Record the action details:
   - **Action Type** — choose from: CLEANING, ADJUSTMENT, PART_REPLACEMENT, WELDING, MACHINING, ELECTRICAL_REPAIR, TESTING, OTHER
   - **Description** — what you did
   - **Component** — which machine component this action relates to (optional)
   - **Spare Parts Used** — list any consumable parts used during repair (optional)
     - Select part, enter quantity, cost is auto-calculated from unit cost
   - **Labor Hours** — time spent on this action
   - **Labor Cost** — auto-calculated or manually entered
   - **Notes** — any special observations
4. Click **Save**
5. Repeat for each distinct repair action performed

**Example Actions for a Pump Repair:**
| Action Type | Parts Used | Hours |
|-------------|-----------|-------|
| CLEANING | None | 0.5 |
| PART_REPLACEMENT | Seal Kit (1 pc) | 1.5 |
| MACHINING | None | 1.0 |
| TESTING | None | 0.5 |

**What the User Should See:**
A form within the repair order. Each action appears as a row in a table with type, description, hours, and cost columns.

---

### 5. Completing the Repair Order / إكمال أمر الإصلاح

**Navigation Path:**
Repair order detail → Complete Repair (تفاصيل أمر الإصلاح → إكمال الإصلاح)

#### 5.1 Complete as Serviceable
1. Ensure all repair actions are recorded
2. Verify the part passes testing
3. Click **Complete Repair**
4. System prompts: "Mark as SERVICEABLE?"
5. Confirm → status changes to COMPLETED_SERVICEABLE
6. **Condition balance effect:**
   - UNDER_REPAIR decreases by quantity
   - SERVICEABLE increases by quantity
   - Total InventoryBalance unchanged
7. The part is now available for re-issue

#### 5.2 Scrap the Part
1. If the part is beyond repair, click **Scrap**
2. Enter **Scrap Reason**
3. Confirm → status changes to SCRAPPED
4. **Condition balance effect:**
   - UNDER_REPAIR decreases by quantity
   - SCRAPPED increases by quantity
   - Total InventoryBalance decreases (write-off)

**What the User Should See:**
A confirmation dialog showing condition balance before/after effect. After completion, the repair order shows the final status with a summary of total cost (labor + parts).

---

### 6. Viewing Repair History / عرض سجل الإصلاح

**Navigation Path:**
Maintenance → Repair Orders → History (أوامر الصيانة → أوامر الإصلاح → السجل)

**Step-by-Step Instructions:**
1. Navigate to **Repair Orders History**
2. View all repair orders with their current status
3. Filter by:
   - Spare part code/name
   - Date range
   - Status
   - Technician
4. Click any repair order to see full lifecycle:
   - Status change timeline with timestamps
   - All repair actions recorded
   - Total cost breakdown (labor + parts)
   - Audit trail of who did what and when

**What the User Should See:**
A searchable, filterable data grid of repair orders with status badges. Detail view shows a timeline of status changes and a table of actions.

---

## Hands-On Exercise / تمرين عملي

**Scenario:**
A returned defective "Coolant Pump" (SP-CNC-007) is in the store. You need to repair it.

**Task:**
1. **Create** a repair order for Coolant Pump (SP-CNC-007):
   - Source Type: RETURN
   - Quantity: 1
   - Fault Description: "المضخة لا تعمل — لا يوجد دوران — المحرك ساخن جداً"
   - Received From: "Ahmed — Technician"
2. **Start Inspection** — status changes to IN_INSPECTION
   - Verify condition balance: DEFECTIVE decreases by 1, UNDER_REPAIR increases by 1
3. **Complete Inspection** — mark as repairable:
   - Inspection Notes: "تم فحص المحرك — ملفات المحرك سليمة — الكوبلن متآكل — يحتاج تغيير كوبلن ومحامل"
   - Status changes to APPROVED_FOR_REPAIR
4. Click **Start Repair** — status changes to UNDER_REPAIR
5. **Record 2 repair actions:**
   - Action 1: PART_REPLACEMENT — "Coupling Replacement" — used "Coupling D25" (1 pc) — 1 hour
   - Action 2: PART_REPLACEMENT — "Bearing Replacement" — used "Bearing 6205" (2 pcs) — 1.5 hours
6. Click **Start Test** — status changes to UNDER_TEST
7. Click **Complete Repair** → mark as SERVICEABLE
   - Verify condition balance: UNDER_REPAIR decreases by 1, SERVICEABLE increases by 1

**Expected Result:**
- Repair order created and progressed through all statuses to COMPLETED_SERVICEABLE
- 2 repair actions recorded with parts and labor
- Condition balance reflects correct transitions
- Total cost = (Coupling D25 unit cost × 1) + (Bearing 6205 unit cost × 2) + labor (2.5 hrs × rate)

---

## Assessment / تقييم

**Quiz Questions:**

1. Which repair order status does NOT change the condition balance?
   - A) IN_INSPECTION
   - B) COMPLETED_SERVICEABLE
   - C) UNDER_REPAIR
   - D) DRAFT

2. What happens to total InventoryBalance when a repair order is completed as SERVICEABLE?
   - A) It increases
   - B) It decreases
   - C) It stays the same
   - D) It depends on the part

3. When scrapping a part, which condition balances change?
   - A) DEFECTIVE decreases, SCRAPPED increases
   - B) UNDER_REPAIR decreases, SCRAPPED increases, InventoryBalance decreases
   - C) SERVICEABLE decreases, SCRAPPED increases
   - D) UNDER_REPAIR decreases, SERVICEABLE increases

4. What prevents creating two repair orders from the same returned part?
   - A) Manual check by store keeper
   - B) Duplicate guard by sourceType + sourceId
   - C) Permission restriction
   - D) The system allows it but warns

5. When recording a repair action, which of these is NOT a standard action type?
   - A) CLEANING
   - B) PART_REPLACEMENT
   - C) INVOICING
   - D) TESTING

**Practical Verification:**
- Trainee creates a repair order correctly
- Trainee progresses through all lifecycle statuses
- Trainee records repair actions with parts and labor
- Trainee verifies condition balance after each transition

---

## Quick Reference Card / بطاقة مرجعية سريعة

| Action | Navigation | Key Field(s) |
|--------|-----------|--------------|
| Create repair order | Maintenance → Repair Orders → Create | Source, Spare Part, Fault Description |
| Start inspection | Repair order → Start Inspection | Inspection notes |
| Record action | Repair order → Actions → Add Action | Action Type, Description, Parts, Hours |
| Complete repair | Repair order → Complete Repair | Confirmation |
| Scrap | Repair order → Scrap | Scrap reason |

- Lifecycle: DRAFT → OPEN → IN_INSPECTION → APPROVED_FOR_REPAIR → UNDER_REPAIR → UNDER_TEST → COMPLETED_SERVICEABLE
- Condition transitions: DEFECTIVE → UNDER_REPAIR (at inspection), UNDER_REPAIR → SERVICEABLE (at complete)
- Scrapping reduces total InventoryBalance
- Repair actions are audited with timestamp and user
- Always inspect before starting repair — mark unrepairable parts for scrap immediately
- Duplicate guard prevents double-processing the same returned part
- Total cost = sum of all repair action costs (labor + parts)