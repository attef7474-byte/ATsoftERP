# Training Module: Store Keeper / أمين المستودع

| Field | Value |
|-------|-------|
| Module ID | TRN-MNT-004 |
| Role | Store Keeper / أمين المستودع |
| Duration | 2 hours |
| Prerequisites | Basic inventory knowledge, familiarity with warehouse operations |
| Version | 1.0 |
| Date | 2026-07-29 |

## Learning Objectives / أهداف التعلم
- Process stock issue requests for spare parts from the SPARE_PART warehouse
- Validate inventory balance before issuing
- Manage spare part condition balance (serviceable, defective, under repair)
- Process returned defective parts from technicians
- Handle condition transitions for repair order workflows
- Understand blocked warehouses (PRODUCT and RAW_MATERIAL cannot be used for maintenance)

## System Access / صلاحيات النظام
Required permissions:
- `inventory-stock-issue:create`
- `inventory-stock-issue:read`
- `inventory-stock-issue:approve`
- `inventory-balances:read`
- `spare-part-condition-balance:read`
- `spare-part-condition-movement:read`

## Module Content / محتوى الوحدة

### 1. Stock Issue Workflow / سير عمل صرف المخزون

**Navigation Path:**
Inventory → Stock Issue → Create (المخزون → صرف المخزون → إنشاء)

**Step-by-Step Instructions:**
1. Navigate to **Stock Issue** under the Inventory module
2. Click **Create Stock Issue**
3. The system auto-fills organization context (company, branch) — **do not change**
4. Select **Warehouse** — must be of type **SPARE_PART** (warehouses of type PRODUCT or RAW_MATERIAL are blocked and will not appear in the dropdown)
5. Select **Issue Type** — "Maintenance Spare Part" or "Maintenance Stock Issue"
6. Add line items:
   - Click **Add Item**
   - Search for the **Spare Part** by code or name
   - Enter **Quantity** to issue
   - The system displays **Available Balance** in the selected warehouse
   - Verify the available balance is sufficient before proceeding
   - The system will **prevent issuance** if balance is insufficient
   - Click **Add**
   - Repeat for each spare part
7. Optionally link the issue to a **Maintenance Request Number**
8. Enter **Issued To** — technician name or employee ID
9. Click **Save** → status is DRAFT
10. Click **Submit for Approval** → status becomes PENDING
11. After approval: click **Issue** → status becomes ISSUED
    - InventoryBalance decreases atomically
    - InventoryMovement record is created
    - SparePartConditionBalance (serviceable) decreases

**Key Rules:**
- **Only SPARE_PART warehouse type** is allowed for maintenance stock issue
- PRODUCT and RAW_MATERIAL warehouses are **blocked**
- Available balance must be ≥ requested quantity (system validates and blocks otherwise)
- Issued quantity cannot exceed available balance
- The stock issue number is auto-generated via NumberingService

**What the User Should See:**
A warehouse dropdown filtered to SPARE_PART type only. Add Item dialog shows spare part search with available balance column. After issuing, a success toast with the transaction number.

---

### 2. Condition Balance Management / إدارة رصيد الحالة

**Navigation Path:**
Maintenance → Spare Parts → Condition Balances (أوامر الصيانة → قطع الغيار → أرصدة الحالة)

**Step-by-Step Instructions:**
1. Navigate to **Condition Balances**
2. View the current balance for each spare part split by condition:
   - **SERVICEABLE** — ready to use
   - **DEFECTIVE** — failed and awaiting decision (repair or scrap)
   - **UNDER_REPAIR** — sent to repair workshop
   - **SCRAPPED** — beyond repair, written off
3. Search by spare part code or name
4. Click a row to view the **movement history** for that part and condition
5. Movements show the transaction type (ISSUE, RETURN, REPAIR_IN, REPAIR_OUT, SCRAP, ADJUSTMENT)

**Key Concepts:**
| Condition | Meaning | Can Issue? | Can Return To? |
|-----------|---------|-----------|----------------|
| SERVICEABLE | New or fully functional | Yes | Supplier or Repair |
| DEFECTIVE | Failed during use | No | Repair or Scrap |
| UNDER_REPAIR | At repair workshop | No | Serviceable (after repair) |
| SCRAPPED | Written off | No | None |

**What the User Should See:**
A data grid showing spare part, total balance, and a column for each condition with quantities. Click-through to movement details.

---

### 3. Processing Returned Defective Parts / معالجة قطع الغيار التالفة المرتجعة

**Navigation Path:**
Inventory → Stock Issue → Returns → Create Return (المخزون → صرف المخزون → مرتجعات → إنشاء مرتجع)

**Step-by-Step Instructions:**
1. Navigate to **Returns** under Stock Issue
2. Click **Create Return**
3. Search for the original **Stock Issue Transaction** by number
4. The system shows all issued items from that transaction
5. Select the spare part being returned
6. Enter **Return Quantity** (cannot exceed originally issued quantity)
7. Select **Condition on Return** — typically DEFECTIVE
8. Enter **Return Reason** (e.g., "Failed during installation", "Defective on arrival")
9. Optionally select **Destination**:
   - **Return to Stock (SERVICEABLE)** — if part is actually good
   - **Send to Repair (DEFECTIVE → UNDER_REPAIR)** — initiates repair workflow
   - **Scrap** — if part is beyond repair
10. Click **Save**

**Automatic Ledger Updates:**
- If returned as SERVICEABLE → SparePartConditionBalance SERVICEABLE increases, InventoryBalance increases
- If returned as DEFECTIVE → SparePartConditionBalance DEFECTIVE increases, InventoryBalance increases (quantity returns to balance)
- A SparePartConditionMovement record is created

**What the User Should See:**
A return form pre-populated from the original issue transaction. After saving, balance updates are reflected immediately in condition balances.

---

### 4. Managing Condition Transitions for Repair Orders / إدارة انتقالات الحالة لأوامر الإصلاح

**Navigation Path:**
Maintenance → Repair Orders → Manage (أوامر الصيانة → أوامر الإصلاح → إدارة)

**Note:** This section covers the store keeper's role in the repair workflow — specifically condition balance changes at each stage. The full repair order lifecycle is covered in TRN-MNT-005.

**Step-by-Step Instructions:**

#### 4.1 Receiving Part for Repair (DEFECTIVE → UNDER_REPAIR)
1. When a repair order is created from a returned defective part:
   - The store keeper verifies the physical part matches the repair order
   - Marks the part as **Received for Repair**
   - System automatically moves condition balance: DEFECTIVE decreases, UNDER_REPAIR increases
   - No change to total InventoryBalance

#### 4.2 Completing Repair (UNDER_REPAIR → SERVICEABLE)
1. When the repair is completed (COMPLETED_SERVICEABLE status):
   - The store keeper receives the repaired part
   - Verifies the repair order is marked COMPLETED_SERVICEABLE
   - Confirms receipt of physical part
   - System automatically moves condition balance: UNDER_REPAIR decreases, SERVICEABLE increases
   - No change to total InventoryBalance

#### 4.3 Scrapping Part (DEFECTIVE → SCRAPPED)
1. When a repair order is scrapped:
   - The store keeper verifies the scrapped part physically
   - Confirms in system
   - System automatically moves condition balance: DEFECTIVE (or UNDER_REPAIR) decreases, SCRAPPED increases
   - InventoryBalance decreases (quantity is written off)

**What the User Should See:**
Repair order detail page with condition balance section showing before/after quantities at each stage.

---

## Hands-On Exercise / تمرين عملي

**Scenario:**
A technician requests 5 units of "Spindle Bearing Set" (SP-CNC-001) for CNC-Mill-02.

**Task:**
1. Navigate to **Stock Issue** and create a new issue:
   - Warehouse: "SP-Store" (SPARE_PART type)
   - Issue Type: "Maintenance Spare Part"
   - Add item: "Spindle Bearing Set" — Quantity: 5
   - Link to maintenance request: MR-2026-00015
   - Issued To: "Ahmed — Technician"
2. Submit the issue for approval
3. After the supervisor approves, click **Issue** to complete the transaction
4. Verify the balance decreased:
   - Go to **Condition Balances**
   - Search "Spindle Bearing Set" — SERVICEABLE balance should be reduced by 5
5. Now process a return:
   - The technician returns 2 units that were defective
   - Create a **Return** for the original stock issue transaction
   - Quantity: 2, Condition: DEFECTIVE, Destination: "Send to Repair"
6. Verify:
   - DEFECTIVE balance increased by 2
   - SERVICEABLE balance remains unchanged (defective units went to DEFECTIVE, not SERVICEABLE)

**Expected Result:**
- Stock issue created with 5 units, after processing SERVICEABLE reduced by 5
- Return processed: 2 units in DEFECTIVE condition
- Condition balance shows: SERVICEABLE -5, DEFECTIVE +2

---

## Assessment / تقييم

**Quiz Questions:**

1. Which warehouse types are allowed for maintenance stock issue?
   - A) PRODUCT only
   - B) SPARE_PART only
   - C) Any warehouse type
   - D) RAW_MATERIAL only

2. What happens when a stock issue is completed (ISSUED status)?
   - A) Only InventoryBalance decreases
   - B) InventoryBalance decreases and InventoryMovement is created
   - C) Nothing changes in inventory
   - D) Only the condition balance changes

3. Which condition balance increases when a defective part is sent for repair?
   - A) SERVICEABLE
   - B) DEFECTIVE
   - C) UNDER_REPAIR
   - D) SCRAPPED

4. When a part is returned as DEFECTIVE, what happens to total InventoryBalance?
   - A) It decreases
   - B) It increases
   - C) It stays the same (quantity returns to balance, but in DEFECTIVE condition)
   - D) It doubles

5. What is the correct sequence when scrapping a part?
   - A) SERVICEABLE decreases, SCRAPPED increases
   - B) DEFECTIVE decreases, SCRAPPED increases, InventoryBalance decreases
   - C) UNDER_REPAIR decreases, SERVICEABLE increases
   - D) DEFECTIVE increases, SCRAPPED decreases

**Practical Verification:**
- Trainee creates a stock issue with correct warehouse type
- Trainee verifies balance before issuing
- Trainee processes a return with correct condition assignment
- Trainee reads condition balance report and interprets correctly

---

## Quick Reference Card / بطاقة مرجعية سريعة

| Action | Navigation | Key Field(s) |
|--------|-----------|--------------|
| Create stock issue | Inventory → Stock Issue → Create | Warehouse (SPARE_PART only), Part, Quantity |
| View condition balances | Maintenance → Spare Parts → Condition Balances | Spare part search |
| Process return | Inventory → Stock Issue → Returns → Create | Original issue, Quantity, Condition |
| Verify balances | Inventory → Balances | Spare part code |

- PRODUCT and RAW_MATERIAL warehouses are BLOCKED for maintenance
- Condition balances track: SERVICEABLE, DEFECTIVE, UNDER_REPAIR, SCRAPPED
- Returns increase total InventoryBalance (quantity returns)
- Repair condition moves (DEFECTIVE↔UNDER_REPAIR↔SERVICEABLE) do NOT change total InventoryBalance
- Scrapping reduces total InventoryBalance
- Always verify physical part before processing condition transitions
- Auto-generated issue number — never enter manually