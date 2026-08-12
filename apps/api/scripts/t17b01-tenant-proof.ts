import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const API_URL = process.env.PROOF_API_URL || "http://localhost:4100/api/v1";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

const ADMIN_EMAIL = requireEnv("SEED_ADMIN_EMAIL");
const ADMIN_PASSWORD = requireEnv("SEED_ADMIN_PASSWORD");

interface CaseResult {
  name: string;
  method: string;
  endpoint: string;
  expected: string;
  actual: string;
  pass: boolean;
  detail?: string;
}

const results: CaseResult[] = [];

interface Fixtures {
  companyA: string;
  branchA1: string;
  branchA2: string;
  whA1: string;
  whA: string;
  companyB: string;
  branchB1: string;
  whB: string;
  product: string;
  adjustments: string[];
}

const fixtures: Fixtures = {
  companyA: "",
  branchA1: "",
  branchA2: "",
  whA1: "",
  whA: "",
  companyB: "",
  branchB1: "",
  whB: "",
  product: "",
  adjustments: [],
};

function record(
  name: string,
  method: string,
  endpoint: string,
  expected: string,
  actual: string,
  pass: boolean,
  detail?: string,
): void {
  results.push({ name, method, endpoint, expected, actual, pass, detail });
}

async function httpJson(
  method: string,
  path: string,
  token: string | null,
  headers: Record<string, string> = {},
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let responseBody: unknown = null;
  try {
    responseBody = await response.json();
  } catch {
    responseBody = null;
  }
  return { status: response.status, body: responseBody };
}

function messageKeyOf(body: unknown): string {
  const candidate = body as { messageKey?: string; errors?: { messageKey?: string }[] };
  if (candidate?.messageKey) return candidate.messageKey;
  if (candidate?.errors && candidate.errors.length > 0) return candidate.errors[0].messageKey || "";
  return "";
}

async function waitForApi(): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`API not reachable at ${API_URL} after 90s`);
}

async function login(email: string, password: string): Promise<string> {
  const { status, body } = await httpJson("POST", "/auth/login", null, {}, { email, password });
  if (status !== 201 && status !== 200) {
    throw new Error(`login failed: HTTP ${status} ${JSON.stringify(body)}`);
  }
  const token = (body as { accessToken?: string }).accessToken;
  if (!token) throw new Error(`login returned no accessToken`);
  return token;
}

async function createAdjustmentFixture(
  companyId: string,
  branchId: string | null,
  warehouseId: string,
  code: string,
  status: string,
  lines: { type: string; quantity: number }[] = [{ type: "ADJUSTMENT_IN", quantity: 7 }],
): Promise<string> {
  const doc = await prisma.inventoryStockAdjustment.create({
    data: {
      code,
      companyId,
      branchId,
      warehouseId,
      status,
      reason: "T17B01_ fixture",
      documentDate: new Date(),
    },
  });
  for (const line of lines) {
    await prisma.inventoryStockAdjustmentLine.create({
      data: {
        adjustmentId: doc.id,
        productId: fixtures.product,
        adjustmentType: line.type,
        quantity: line.quantity,
      },
    });
  }
  return doc.id;
}

function inList(list: unknown, id: string): boolean {
  if (!Array.isArray(list)) return false;
  return list.some((item) => (item as { id?: string }).id === id);
}

async function main(): Promise<void> {
  await waitForApi();
  const token = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  const saSeq = await prisma.numberSequence.findUnique({ where: { code: "STOCK_ADJUSTMENT" } });
  const mvSeq = await prisma.numberSequence.findUnique({ where: { code: "INVENTORY_MOVEMENT" } });
  if (!saSeq || saSeq.status !== "ACTIVE") throw new Error("STOCK_ADJUSTMENT sequence missing/inactive");
  if (!mvSeq || mvSeq.status !== "ACTIVE") throw new Error("INVENTORY_MOVEMENT sequence missing/inactive");
  record("number sequences exist for STOCK_ADJUSTMENT and INVENTORY_MOVEMENT", "db", "number_sequences", "ACTIVE", `${saSeq.status}/${mvSeq.status}`, saSeq.status === "ACTIVE" && mvSeq.status === "ACTIVE");

  // --- Fixtures ---
  const companyA = await prisma.company.create({ data: { code: "T17B01_CA", name: "T17B01 Proof Company A" } });
  const companyB = await prisma.company.create({ data: { code: "T17B01_CB", name: "T17B01 Proof Company B" } });
  fixtures.companyA = companyA.id;
  fixtures.companyB = companyB.id;

  const branchA1 = await prisma.branch.create({ data: { companyId: companyA.id, code: "T17B01_BA1", name: "T17B01 Proof Branch A1" } });
  const branchA2 = await prisma.branch.create({ data: { companyId: companyA.id, code: "T17B01_BA2", name: "T17B01 Proof Branch A2" } });
  const branchB1 = await prisma.branch.create({ data: { companyId: companyB.id, code: "T17B01_BB1", name: "T17B01 Proof Branch B1" } });
  fixtures.branchA1 = branchA1.id;
  fixtures.branchA2 = branchA2.id;
  fixtures.branchB1 = branchB1.id;

  const whA1 = await prisma.warehouse.create({ data: { companyId: companyA.id, branchId: branchA1.id, code: "T17B01_WH_A1", name: "T17B01 Proof Warehouse A1" } });
  const whA = await prisma.warehouse.create({ data: { companyId: companyA.id, branchId: null, code: "T17B01_WH_A", name: "T17B01 Proof Warehouse A (company-wide)" } });
  const whB = await prisma.warehouse.create({ data: { companyId: companyB.id, branchId: branchB1.id, code: "T17B01_WH_B", name: "T17B01 Proof Warehouse B" } });
  fixtures.whA1 = whA1.id;
  fixtures.whA = whA.id;
  fixtures.whB = whB.id;

  const product = await prisma.product.create({ data: { code: "T17B01_PROD", name: "T17B01 Proof Product", unit: "PC" } });
  fixtures.product = product.id;

  const ctxA1 = { "x-active-company-id": companyA.id, "x-active-branch-id": branchA1.id };
  const ctxA2 = { "x-active-company-id": companyA.id, "x-active-branch-id": branchA2.id };
  const ctxB1 = { "x-active-company-id": companyB.id, "x-active-branch-id": branchB1.id };
  const base = "/inventory/stock-adjustments";

  // ============ POSITIVE STATE MACHINE (document created as DB fixture; API create is blocked by the pre-existing PERIOD_LOCK) ============
  const p1 = await createAdjustmentFixture(companyA.id, branchA1.id, whA1.id, `T17B01_SA_P1_${Date.now()}`, "DRAFT", [
    { type: "ADJUSTMENT_IN", quantity: 5 },
    { type: "ADJUSTMENT_OUT", quantity: 2 },
  ]);
  fixtures.adjustments.push(p1);

  let response = await httpJson("PATCH", `${base}/${p1}`, token, ctxA1, { reason: "T17B01_ positive flow (updated)" });
  const patchBody = response.body as { id?: string };
  record(
    "P1 update edits the same record (no duplicate created)",
    "PATCH",
    `${base}/${p1}`,
    "200 + same id",
    `${response.status} id=${patchBody?.id}`,
    (response.status === 200 || response.status === 201) && patchBody?.id === p1,
  );

  response = await httpJson("GET", `${base}/${p1}/summary`, token, ctxA1);
  const sum = response.body as { totalIn?: number; totalOut?: number; lineCount?: number };
  record(
    "P2 summary totals computed for owned adjustment",
    "GET",
    `${base}/${p1}/summary`,
    "200 in=5 out=2 count=2",
    `${response.status} in=${sum?.totalIn} out=${sum?.totalOut} count=${sum?.lineCount}`,
    response.status === 200 && sum?.totalIn === 5 && sum?.totalOut === 2 && sum?.lineCount === 2,
  );

  response = await httpJson("POST", `${base}/${p1}/submit`, token, ctxA1);
  record("P3 submit DRAFT -> SUBMITTED", "POST", `${base}/${p1}/submit`, "200/201 SUBMITTED", `${response.status} ${(response.body as { status?: string })?.status}`, (response.status === 200 || response.status === 201) && (response.body as { status?: string })?.status === "SUBMITTED");

  response = await httpJson("POST", `${base}/${p1}/approve`, token, ctxA1);
  record("P4 approve SUBMITTED -> APPROVED", "POST", `${base}/${p1}/approve`, "200/201 APPROVED", `${response.status} ${(response.body as { status?: string })?.status}`, (response.status === 200 || response.status === 201) && (response.body as { status?: string })?.status === "APPROVED");

  const beforePostMovements = await prisma.inventoryMovement.count({ where: { sourceType: "STOCK_ADJUSTMENT", sourceId: p1 } });
  const beforePostBalance = await prisma.inventoryBalance.findFirst({ where: { warehouseId: whA1.id, productId: product.id, locationId: null } });

  response = await httpJson("POST", `${base}/${p1}/post`, token, ctxA1);
  const posted = (response.body as { status?: string })?.status;
  const afterPostMovements = await prisma.inventoryMovement.findMany({ where: { sourceType: "STOCK_ADJUSTMENT", sourceId: p1 } });
  const afterPostBalance = await prisma.inventoryBalance.findFirst({ where: { warehouseId: whA1.id, productId: product.id, locationId: null } });
  record(
    "P5 post creates movements and balance atomically (tenant inherited)",
    "POST",
    `${base}/${p1}/post`,
    "200/201 POSTED, before=(0, none), after=2 movements (CA/A1) + balance 3",
    `${response.status} ${posted} before=(${beforePostMovements}, ${beforePostBalance === null ? "none" : beforePostBalance.quantity}) after=(${afterPostMovements.length}, ${afterPostBalance?.quantity})`,
    (response.status === 200 || response.status === 201) &&
      posted === "POSTED" &&
      beforePostMovements === 0 && beforePostBalance === null &&
      afterPostMovements.length === 2 && afterPostMovements.every((m) => m.companyId === companyA.id && m.branchId === branchA1.id) &&
      afterPostBalance !== null && Number(afterPostBalance.quantity) === 3,
  );

  response = await httpJson("POST", `${base}/${p1}/post`, token, ctxA1);
  const secondPostMovements = await prisma.inventoryMovement.count({ where: { sourceType: "STOCK_ADJUSTMENT", sourceId: p1 } });
  const secondPostBalance = await prisma.inventoryBalance.findFirst({ where: { warehouseId: whA1.id, productId: product.id, locationId: null } });
  record(
    "P6 second post rejected (400) with zero side effects",
    "POST",
    `${base}/${p1}/post`,
    "400 stockAdjustmentOnlyApprovedCanPost + movements=2 + balance=3",
    `${response.status} ${messageKeyOf(response.body)} movements=${secondPostMovements} balance=${secondPostBalance?.quantity}`,
    response.status === 400 && messageKeyOf(response.body) === "inventory.stockAdjustmentOnlyApprovedCanPost" && secondPostMovements === 2 && secondPostBalance !== null && Number(secondPostBalance.quantity) === 3,
  );

  response = await httpJson("GET", `${base}/${p1}`, token, ctxA1);
  record("P7 findOne returns the owned adjustment", "GET", `${base}/${p1}`, "200", String(response.status), response.status === 200);

  response = await httpJson("GET", base, token, ctxA1);
  const listA1 = response.body as { data?: unknown[] };
  record("P8 findAll from context A1 lists the adjustment", "GET", base, "200 + id in list", `${response.status}`, response.status === 200 && inList(listA1?.data, p1));

  // ============ CROSS-TENANT NEGATIVE (context A1 attempting branch A2 / company B documents) ============
  const saA2Draft = await createAdjustmentFixture(companyA.id, branchA2.id, whA.id, `T17B01_SA_A2_${Date.now()}`, "DRAFT");
  const saA2Approved = await createAdjustmentFixture(companyA.id, branchA2.id, whA.id, `T17B01_SA_A2P_${Date.now()}`, "APPROVED");
  fixtures.adjustments.push(saA2Draft, saA2Approved);

  response = await httpJson("GET", `${base}/${saA2Draft}`, token, ctxA1);
  record("N1 cross-branch findOne denied (404)", "GET", `${base}/${saA2Draft}`, "404", String(response.status), response.status === 404);

  response = await httpJson("PATCH", `${base}/${saA2Draft}`, token, ctxA1, { reason: "T17B01_ hostile update" });
  record("N2 cross-branch update denied (404)", "PATCH", `${base}/${saA2Draft}`, "404", String(response.status), response.status === 404);

  response = await httpJson("POST", `${base}/${saA2Draft}/submit`, token, ctxA1);
  record("N3 cross-branch submit denied (404)", "POST", `${base}/${saA2Draft}/submit`, "404", String(response.status), response.status === 404);

  response = await httpJson("POST", `${base}/${saA2Approved}/approve`, token, ctxA1);
  record("N4 cross-branch approve denied (404)", "POST", `${base}/${saA2Approved}/approve`, "404", String(response.status), response.status === 404);

  const preBranchMovements = await prisma.inventoryMovement.count({ where: { sourceType: "STOCK_ADJUSTMENT", sourceId: saA2Approved } });
  const preBranchBalance = await prisma.inventoryBalance.findFirst({ where: { warehouseId: whA.id, productId: product.id, locationId: null } });
  response = await httpJson("POST", `${base}/${saA2Approved}/post`, token, ctxA1);
  const postBranchMovements = await prisma.inventoryMovement.count({ where: { sourceType: "STOCK_ADJUSTMENT", sourceId: saA2Approved } });
  const postBranchBalance = await prisma.inventoryBalance.findFirst({ where: { warehouseId: whA.id, productId: product.id, locationId: null } });
  record(
    "N5 cross-branch post denied with zero movement/balance side effects",
    "POST",
    `${base}/${saA2Approved}/post`,
    "404 + no movement + no balance",
    `${response.status} before=(${preBranchMovements}, ${preBranchBalance === null ? "none" : "present"}) after=(${postBranchMovements}, ${postBranchBalance === null ? "none" : "present"})`,
    response.status === 404 && postBranchMovements === 0 && postBranchBalance === null,
  );

  response = await httpJson("DELETE", `${base}/${saA2Draft}`, token, ctxA1);
  const saA2StillThere = await prisma.inventoryStockAdjustment.findUnique({ where: { id: saA2Draft } });
  record(
    "N6 cross-branch delete denied; document left intact",
    "DELETE",
    `${base}/${saA2Draft}`,
    "404 + doc exists",
    `${response.status} exists=${saA2StillThere !== null}`,
    response.status === 404 && saA2StillThere !== null,
  );

  response = await httpJson("GET", `${base}/${saA2Draft}/summary`, token, ctxA1);
  record("N7 cross-branch summary denied (404)", "GET", `${base}/${saA2Draft}/summary`, "404", String(response.status), response.status === 404);

  response = await httpJson("GET", base, token, ctxA1);
  const listA1b = response.body as { data?: unknown[] };
  record(
    "N8 cross-branch documents never appear in context A1 list",
    "GET",
    base,
    "not in list",
    `inList=${inList(listA1b?.data, saA2Draft) || inList(listA1b?.data, saA2Approved)}`,
    !inList(listA1b?.data, saA2Draft) && !inList(listA1b?.data, saA2Approved),
  );

  response = await httpJson("GET", base, token, ctxA2);
  const listA2 = response.body as { data?: unknown[] };
  record(
    "N9 owning branch A2 sees its own document in its list",
    "GET",
    base,
    "200 + A2 doc in list",
    `${response.status} inList=${inList(listA2?.data, saA2Draft)}`,
    response.status === 200 && inList(listA2?.data, saA2Draft),
  );

  // Owning branch A2 CAN post its own APPROVED document (contrast to N5)
  const preOwnBranchMovements = await prisma.inventoryMovement.count({ where: { sourceType: "STOCK_ADJUSTMENT", sourceId: saA2Approved } });
  response = await httpJson("POST", `${base}/${saA2Approved}/post`, token, ctxA2);
  const ownBranchMovements = await prisma.inventoryMovement.findMany({ where: { sourceType: "STOCK_ADJUSTMENT", sourceId: saA2Approved } });
  const ownBranchBalance = await prisma.inventoryBalance.findFirst({ where: { warehouseId: whA.id, productId: product.id, locationId: null } });
  record(
    "P9 owning branch A2 posts its own document (movement/balance created)",
    "POST",
    `${base}/${saA2Approved}/post`,
    "200/201 POSTED + movement (CA/A2) + balance 7",
    `${response.status} ${(response.body as { status?: string })?.status} before=${preOwnBranchMovements} after=${ownBranchMovements.length} balance=${ownBranchBalance?.quantity}`,
    (response.status === 200 || response.status === 201) && (response.body as { status?: string })?.status === "POSTED" && preOwnBranchMovements === 0 && ownBranchMovements.length === 1 && ownBranchMovements[0]?.companyId === companyA.id && ownBranchMovements[0]?.branchId === branchA2.id && ownBranchBalance !== null && Number(ownBranchBalance.quantity) === 7,
  );

  // ============ CROSS-COMPANY NEGATIVE ============
  const saB1Draft = await createAdjustmentFixture(companyB.id, branchB1.id, whB.id, `T17B01_SA_B1_${Date.now()}`, "DRAFT");
  const saB1Approved = await createAdjustmentFixture(companyB.id, branchB1.id, whB.id, `T17B01_SA_B1P_${Date.now()}`, "APPROVED");
  fixtures.adjustments.push(saB1Draft, saB1Approved);

  response = await httpJson("GET", `${base}/${saB1Draft}`, token, ctxA1);
  record("N10 cross-company findOne denied (404)", "GET", `${base}/${saB1Draft}`, "404", String(response.status), response.status === 404);

  response = await httpJson("PATCH", `${base}/${saB1Draft}`, token, ctxA1, { reason: "T17B01_ hostile update" });
  record("N11 cross-company update denied (404)", "PATCH", `${base}/${saB1Draft}`, "404", String(response.status), response.status === 404);

  response = await httpJson("POST", `${base}/${saB1Draft}/submit`, token, ctxA1);
  record("N12 cross-company submit denied (404)", "POST", `${base}/${saB1Draft}/submit`, "404", String(response.status), response.status === 404);

  const preCompanyMovements = await prisma.inventoryMovement.count({ where: { sourceType: "STOCK_ADJUSTMENT", sourceId: saB1Approved } });
  const preCompanyBalance = await prisma.inventoryBalance.findFirst({ where: { warehouseId: whB.id, productId: product.id, locationId: null } });
  response = await httpJson("POST", `${base}/${saB1Approved}/post`, token, ctxA1);
  const postCompanyMovements = await prisma.inventoryMovement.count({ where: { sourceType: "STOCK_ADJUSTMENT", sourceId: saB1Approved } });
  const postCompanyBalance = await prisma.inventoryBalance.findFirst({ where: { warehouseId: whB.id, productId: product.id, locationId: null } });
  record(
    "N13 cross-company post denied with zero movement/balance side effects",
    "POST",
    `${base}/${saB1Approved}/post`,
    "404 + no movement + no balance",
    `${response.status} before=(${preCompanyMovements}, ${preCompanyBalance === null ? "none" : "present"}) after=(${postCompanyMovements}, ${postCompanyBalance === null ? "none" : "present"})`,
    response.status === 404 && postCompanyMovements === 0 && postCompanyBalance === null,
  );

  response = await httpJson("DELETE", `${base}/${saB1Draft}`, token, ctxA1);
  const saB1StillThere = await prisma.inventoryStockAdjustment.findUnique({ where: { id: saB1Draft } });
  record(
    "N14 cross-company delete denied; document left intact",
    "DELETE",
    `${base}/${saB1Draft}`,
    "404 + doc exists",
    `${response.status} exists=${saB1StillThere !== null}`,
    response.status === 404 && saB1StillThere !== null,
  );

  response = await httpJson("GET", `${base}/${saB1Draft}/summary`, token, ctxA1);
  record("N15 cross-company summary denied (404)", "GET", `${base}/${saB1Draft}/summary`, "404", String(response.status), response.status === 404);

  response = await httpJson("GET", base, token, ctxA1);
  const listA1c = response.body as { data?: unknown[] };
  record(
    "N16 cross-company documents never appear in context A1 list",
    "GET",
    base,
    "not in list",
    `inList=${inList(listA1c?.data, saB1Draft) || inList(listA1c?.data, saB1Approved)}`,
    !inList(listA1c?.data, saB1Draft) && !inList(listA1c?.data, saB1Approved),
  );

  response = await httpJson("GET", base, token, ctxB1);
  const listB1 = response.body as { data?: unknown[] };
  record(
    "N17 owning company B sees its own document in its list",
    "GET",
    base,
    "200 + B1 doc in list",
    `${response.status} inList=${inList(listB1?.data, saB1Draft)}`,
    response.status === 200 && inList(listB1?.data, saB1Draft),
  );

  response = await httpJson("GET", `${base}/${saB1Draft}`, token, ctxB1);
  record("N18 owning company B can read its document", "GET", `${base}/${saB1Draft}`, "200", String(response.status), response.status === 200);

  // Owning company B CAN post its own APPROVED document (contrast to N13)
  const preOwnCompanyMovements = await prisma.inventoryMovement.count({ where: { sourceType: "STOCK_ADJUSTMENT", sourceId: saB1Approved } });
  response = await httpJson("POST", `${base}/${saB1Approved}/post`, token, ctxB1);
  const ownCompanyMovements = await prisma.inventoryMovement.findMany({ where: { sourceType: "STOCK_ADJUSTMENT", sourceId: saB1Approved } });
  const ownCompanyBalance = await prisma.inventoryBalance.findFirst({ where: { warehouseId: whB.id, productId: product.id, locationId: null } });
  record(
    "P10 owning company B posts its own document (movement/balance created)",
    "POST",
    `${base}/${saB1Approved}/post`,
    "200/201 POSTED + movement (CB/B1) + balance 7",
    `${response.status} ${(response.body as { status?: string })?.status} before=${preOwnCompanyMovements} after=${ownCompanyMovements.length} balance=${ownCompanyBalance?.quantity}`,
    (response.status === 200 || response.status === 201) && (response.body as { status?: string })?.status === "POSTED" && preOwnCompanyMovements === 0 && ownCompanyMovements.length === 1 && ownCompanyMovements[0]?.companyId === companyB.id && ownCompanyMovements[0]?.branchId === branchB1.id && ownCompanyBalance !== null && Number(ownCompanyBalance.quantity) === 7,
  );

  // ============ STATUS GUARDS ============
  const p3 = await createAdjustmentFixture(companyA.id, branchA1.id, whA1.id, `T17B01_SA_P3_${Date.now()}`, "DRAFT", [{ type: "ADJUSTMENT_IN", quantity: 1 }]);
  fixtures.adjustments.push(p3);
  await httpJson("POST", `${base}/${p3}/submit`, token, ctxA1);
  response = await httpJson("DELETE", `${base}/${p3}`, token, ctxA1);
  record(
    "P11 delete of a SUBMITTED adjustment rejected (400)",
    "DELETE",
    `${base}/${p3}`,
    "400 stockAdjustmentOnlyDraftCanDelete",
    `${response.status} ${messageKeyOf(response.body)}`,
    response.status === 400 && messageKeyOf(response.body) === "inventory.stockAdjustmentOnlyDraftCanDelete",
  );

  const p5 = await createAdjustmentFixture(companyA.id, branchA1.id, whA1.id, `T17B01_SA_P5_${Date.now()}`, "DRAFT", [{ type: "ADJUSTMENT_IN", quantity: 1 }]);
  fixtures.adjustments.push(p5);
  response = await httpJson("POST", `${base}/${p5}/cancel`, token, ctxA1);
  record(
    "P12 cancel of a DRAFT adjustment succeeds (CANCELLED)",
    "POST",
    `${base}/${p5}/cancel`,
    "200/201 CANCELLED",
    `${response.status} ${(response.body as { status?: string })?.status}`,
    (response.status === 200 || response.status === 201) && (response.body as { status?: string })?.status === "CANCELLED",
  );

  const p6 = await createAdjustmentFixture(companyA.id, branchA1.id, whA1.id, `T17B01_SA_P6_${Date.now()}`, "SUBMITTED", [{ type: "ADJUSTMENT_IN", quantity: 1 }]);
  fixtures.adjustments.push(p6);
  response = await httpJson("POST", `${base}/${p6}/reject`, token, ctxA1);
  record(
    "P13 reject of a SUBMITTED adjustment succeeds (REJECTED)",
    "POST",
    `${base}/${p6}/reject`,
    "200/201 REJECTED",
    `${response.status} ${(response.body as { status?: string })?.status}`,
    (response.status === 200 || response.status === 201) && (response.body as { status?: string })?.status === "REJECTED",
  );

  // ============ INSUFFICIENT STOCK (live side-effect guard) ============
  const p2 = await createAdjustmentFixture(companyA.id, branchA1.id, whA1.id, `T17B01_SA_P2_${Date.now()}`, "DRAFT", [{ type: "ADJUSTMENT_OUT", quantity: 999 }]);
  fixtures.adjustments.push(p2);
  await httpJson("POST", `${base}/${p2}/submit`, token, ctxA1);
  await httpJson("POST", `${base}/${p2}/approve`, token, ctxA1);
  const beforeF = await prisma.inventoryMovement.count({ where: { sourceType: "STOCK_ADJUSTMENT", sourceId: p2 } });
  response = await httpJson("POST", `${base}/${p2}/post`, token, ctxA1);
  const afterF = await prisma.inventoryMovement.count({ where: { sourceType: "STOCK_ADJUSTMENT", sourceId: p2 } });
  const fBalance = await prisma.inventoryBalance.findFirst({ where: { warehouseId: whA1.id, productId: product.id, locationId: null } });
  record(
    "P14 insufficient stock for OUT rejected at post with zero side effects",
    "POST",
    `${base}/${p2}/post`,
    "400 + no movement + balance unchanged (3)",
    `${response.status} before=${beforeF} after=${afterF} balance=${fBalance?.quantity}`,
    response.status === 400 && beforeF === 0 && afterF === 0 && fBalance !== null && Number(fBalance.quantity) === 3,
  );

  // ============ ATOMIC REMOVE (positive) ============
  const p4 = await createAdjustmentFixture(companyA.id, branchA1.id, whA1.id, `T17B01_SA_P4_${Date.now()}`, "DRAFT", [{ type: "ADJUSTMENT_IN", quantity: 3 }]);
  fixtures.adjustments.push(p4);
  response = await httpJson("DELETE", `${base}/${p4}`, token, ctxA1);
  const removedDoc = await prisma.inventoryStockAdjustment.findUnique({ where: { id: p4 } });
  const removedLines = await prisma.inventoryStockAdjustmentLine.count({ where: { adjustmentId: p4 } });
  record(
    "P15 delete of an owned DRAFT is atomic: document and lines removed together",
    "DELETE",
    `${base}/${p4}`,
    "200 + doc gone + lines gone",
    `${response.status} doc=${removedDoc === null ? "gone" : "present"} lines=${removedLines}`,
    (response.status === 200 || response.status === 201) && removedDoc === null && removedLines === 0,
  );

  response = await httpJson("GET", base, token, ctxA1);
  const listE = response.body as { data?: unknown[] };
  record("P16 removed document no longer in list", "GET", base, "not in list", `${response.status}`, response.status === 200 && !inList(listE?.data, p4));

  // ============ NULL-BRANCH (company-level) document invisible from any branch context ============
  const saNull = await createAdjustmentFixture(companyA.id, null, whA.id, `T17B01_SA_NULL_${Date.now()}`, "DRAFT");
  fixtures.adjustments.push(saNull);
  const nullFromA1 = await httpJson("GET", `${base}/${saNull}`, token, ctxA1);
  const nullFromA2 = await httpJson("GET", `${base}/${saNull}`, token, ctxA2);
  const nullFromB1 = await httpJson("GET", `${base}/${saNull}`, token, ctxB1);
  response = await httpJson("GET", base, token, ctxA1);
  const listH = response.body as { data?: unknown[] };
  record(
    "N19 company-level (branchId null) document is not readable from any branch context",
    "GET",
    `${base}/${saNull}`,
    "404 from A1, A2, B1",
    `${nullFromA1.status}/${nullFromA2.status}/${nullFromB1.status}`,
    nullFromA1.status === 404 && nullFromA2.status === 404 && nullFromB1.status === 404 && !inList(listH?.data, saNull),
  );

  // ============ REPORT ============
  const failed = results.filter((entry) => !entry.pass);
  console.log(
    JSON.stringify(
      {
        apiUrl: API_URL,
        summary: { total: results.length, passed: results.length - failed.length, failed: failed.length },
        cases: results,
        failedCases: failed.map((entry) => entry.name),
        blockedLivePaths: [
          "POST /inventory/stock-adjustments (create) - blocked by pre-existing PERIOD_LOCK PF-TEST-001 (403 from InventoryLockGuard)",
          "POST /inventory/stock-adjustments/:id/lines (addLine) - blocked by pre-existing PERIOD_LOCK PF-TEST-001 (403 from InventoryLockGuard)",
          "Warehouse tenant checks on create (company-wide usable / branch-bound rejected / cross-company rejected) - blocked by pre-existing PERIOD_LOCK PF-TEST-001",
        ],
      },
      null,
      2,
    ),
  );
  if (failed.length > 0) {
    console.error(`T17B01 LIVE PROOF FAILED: ${failed.length} case(s) did not pass.`);
    process.exitCode = 1;
  } else {
    console.log("T17B01 LIVE PROOF PASSED: all non-blocked tenant isolation cases verified against the real API and database.");
  }
}

async function cleanup(): Promise<void> {
  console.log("T17B01 live proof cleanup starting...");
  try {
    const ids = [...new Set(fixtures.adjustments.filter((id) => id))];
    for (const id of ids) {
      try {
        const movements = await prisma.inventoryMovement.findMany({ where: { sourceType: "STOCK_ADJUSTMENT", sourceId: id }, select: { id: true } });
        for (const movement of movements) {
          await prisma.inventoryMovementLine.deleteMany({ where: { movementId: movement.id } });
        }
        await prisma.inventoryMovement.deleteMany({ where: { sourceType: "STOCK_ADJUSTMENT", sourceId: id } });
        await prisma.inventoryStockAdjustmentLine.deleteMany({ where: { adjustmentId: id } });
        await prisma.inventoryStockAdjustment.delete({ where: { id } });
        await prisma.auditLog.deleteMany({ where: { entity: "InventoryStockAdjustment", entityId: id } });
      } catch (error) {
        console.error(`cleanup failed for adjustment ${id}:`, (error as Error).message);
      }
    }
  } catch (error) {
    console.error("cleanup of adjustments failed:", (error as Error).message);
  }

  try {
    await prisma.inventoryBalance.deleteMany({ where: { productId: fixtures.product } });
  } catch (error) {
    console.error("cleanup of balances failed:", (error as Error).message);
  }

  try {
    if (fixtures.product) await prisma.product.delete({ where: { id: fixtures.product } });
  } catch (error) {
    console.error("cleanup of product failed:", (error as Error).message);
  }

  const warehouses = [fixtures.whA1, fixtures.whA, fixtures.whB].filter((id) => id);
  for (const id of warehouses) {
    try {
      await prisma.warehouse.delete({ where: { id } });
    } catch (error) {
      console.error(`cleanup of warehouse ${id} failed:`, (error as Error).message);
    }
  }

  const branches = [fixtures.branchA1, fixtures.branchA2, fixtures.branchB1].filter((id) => id);
  for (const id of branches) {
    try {
      await prisma.branch.delete({ where: { id } });
    } catch (error) {
      console.error(`cleanup of branch ${id} failed:`, (error as Error).message);
    }
  }

  const companies = [fixtures.companyA, fixtures.companyB].filter((id) => id);
  for (const id of companies) {
    try {
      await prisma.company.delete({ where: { id } });
    } catch (error) {
      console.error(`cleanup of company ${id} failed:`, (error as Error).message);
    }
  }
  console.log("T17B01 live proof cleanup completed.");
}

main()
  .catch((error) => {
    console.error("T17B01 LIVE PROOF FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
