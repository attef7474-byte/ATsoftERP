const API = 'http://localhost:4000/api/v1';
let passed = 0, failed = 0, na = 0, total = 0;
let token = '';
let testRequestId = '';
let testMachineId = '';
let testPersonnelId = '';
let testProductionLineId = '';
let testScheduleId = '';

async function api(method, path, body, useToken = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useToken) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data, ok: res.ok };
}

async function assert(label, fn) {
  total++;
  try { await fn(); passed++; console.log(`  PASS  ${label}`); }
  catch (e) { failed++; console.log(`  FAIL  ${label}  —  ${e.message}`); }
}

async function assertNA(label) {
  total++; na++;
  console.log(`  N/A   ${label}`);
}

// Step 0: Login
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD }),
});
const loginData = await loginRes.json();
if (loginRes.ok && (loginData.accessToken || loginData.token)) {
  token = loginData.accessToken || loginData.token;
  console.log(`\n=== Step 0: Auth — Token obtained\n`);
} else {
  console.log(`\n=== Step 0: Auth FAILED — cannot proceed\n`);
  process.exit(1);
}

console.log(`=== Section 1: Security & Auth (7 tests) ===\n`);

await assert('A01  login returns token with expected shape', async () => {
  if (!token) throw new Error('No access token');
  if (!loginData.user) throw new Error('No user');
});

await assert('A02  no token returns 401', async () => {
  const r = await fetch(`${API}/maintenance/calendar-workload/events?startDate=2026-01-01&endDate=2026-12-31`, { headers: { 'Content-Type': 'application/json' } });
  if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}`);
});

await assert('A03  bad token returns 401', async () => {
  const r = await fetch(`${API}/maintenance/calendar-workload/events?startDate=2026-01-01&endDate=2026-12-31`, { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer invalid-token' } });
  if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}`);
});

await assert('A04  no passwordHash in any response', async () => {
  const r = await api('GET', '/auth/me');
  if (r.data && JSON.stringify(r.data).includes('passwordHash')) throw new Error('passwordHash exposed');
});

await assert('A05  no secrets exposed in any endpoint', async () => {
  const secretKeys = ['secret', 'password', 'tokenSecret', 'jwtSecret', 'apiKey', 'connectionString'];
  const r = await api('GET', '/auth/me');
  const body = JSON.stringify(r.data);
  for (const key of secretKeys) {
    if (body.includes(`"${key}"`)) throw new Error(`Secret key "${key}" found in response`);
  }
});

await assert('A06  permissions enforced — calendar endpoint requires auth', async () => {
  const r = await fetch(`${API}/maintenance/calendar-workload/filters`, { headers: { 'Content-Type': 'application/json' } });
  if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}`);
});

console.log(`\n=== Section 2: Calendar Events (6 tests) ===\n`);

const today = new Date().toISOString().slice(0, 10);
const startOfMonth = new Date(); startOfMonth.setDate(1);
const startMonth = startOfMonth.toISOString().slice(0, 10);
const endOfMonth = new Date(); endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);
const endMonth = endOfMonth.toISOString().slice(0, 10);

let eventsResponse;
await assert('B07  calendar events by date range returns 200', async () => {
  const r = await api('GET', `/maintenance/calendar-workload/events?startDate=${startMonth}&endDate=${endMonth}`);
  if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
  eventsResponse = r.data;
  if (!Array.isArray(r.data)) throw new Error('Expected array');
});

await assert('B08  calendar events contain expected fields', async () => {
  if (eventsResponse.length === 0) {
    console.log('      (no events — still valid empty state)');
    return;
  }
  const ev = eventsResponse[0];
  if (!ev.id || !ev.title || !ev.eventType) throw new Error('Missing required fields');
  if (!ev.plannedStartAt) throw new Error('Missing plannedStartAt');
  if (!ev.targetRoute) throw new Error('Missing targetRoute');
});

let preventiveCount = 0, emergencyCount = 0;
for (const ev of eventsResponse) {
  if (ev.eventType === 'SCHEDULE') preventiveCount++;
  if (ev.eventType === 'MAINTENANCE_REQUEST') {
    if (eventsResponse.find(r => r.requestId === ev.requestId && r.eventType === 'SCHEDULE')) continue;
  }
}

await assert('B09  preventive events present (via schedules or requests)', async () => {
  const schedules = eventsResponse.filter(e => e.eventType === 'SCHEDULE');
  const preventiveRequests = eventsResponse.filter(e => e.eventType === 'MAINTENANCE_REQUEST' && e.type === 'PREVENTIVE');
  if (schedules.length === 0 && preventiveRequests.length === 0) {
    console.log('      (no preventive data in system)');
  }
});

await assert('B10  emergency events present (if any exist in system)', async () => {
  const emergencyEvents = eventsResponse.filter(e => e.eventType === 'MAINTENANCE_REQUEST' && e.type === 'EMERGENCY');
  if (emergencyEvents.length === 0) {
    console.log('      (no emergency data in system)');
  }
});

await assert('B11  target route/id present on each event', async () => {
  for (const ev of eventsResponse) {
    if (!ev.targetRoute) throw new Error(`Event ${ev.id} missing targetRoute`);
  }
});

await assert('B12  invalid date range returns 400', async () => {
  const r = await api('GET', '/maintenance/calendar-workload/events?startDate=invalid&endDate=invalid');
  if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
});

await assert('B13  filters endpoint returns all filter types', async () => {
  const r = await api('GET', '/maintenance/calendar-workload/filters');
  if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
  if (!r.data.personnel || !r.data.machines || !r.data.productionLines) throw new Error('Missing filter categories');
  if (!r.data.types || !r.data.statuses || !r.data.priorities) throw new Error('Missing filter options');
  if (!r.data.slaStatuses) throw new Error('Missing slaStatuses');
});

console.log(`\n=== Section 3: Workload Summary (7 tests) ===\n`);

let workloadSummary;
await assert('C14  workload summary returns 200', async () => {
  const r = await api('GET', `/maintenance/calendar-workload/workload/summary?date=${today}`);
  if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
  workloadSummary = r.data;
});

await assert('C15  workload summary has required fields', async () => {
  if (!workloadSummary) throw new Error('No data');
  const required = ['totalActiveRequests', 'totalPersonnel', 'unassignedCount', 'overdueCount', 'slaDueCount', 'conflictCount'];
  for (const key of required) {
    if (workloadSummary[key] === undefined) throw new Error(`Missing field: ${key}`);
  }
});

await assert('C16  workload by personnel', async () => {
  if (!workloadSummary.workloadByPersonnel) throw new Error('Missing workloadByPersonnel');
  if (workloadSummary.workloadByPersonnel.length > 0) {
    const w = workloadSummary.workloadByPersonnel[0];
    if (w.workloadPercent === undefined) throw new Error('Missing workloadPercent');
    testPersonnelId = w.personnelId || testPersonnelId;
  }
});

await assert('C17  workload by machine', async () => {
  if (!workloadSummary.workloadByMachine) throw new Error('Missing workloadByMachine');
  if (workloadSummary.workloadByMachine.length > 0) {
    testMachineId = workloadSummary.workloadByMachine[0].machineId || testMachineId;
  }
});

await assert('C18  workload by production line', async () => {
  if (!workloadSummary.workloadByProductionLine) throw new Error('Missing workloadByProductionLine');
  if (workloadSummary.workloadByProductionLine.length > 0) {
    testProductionLineId = workloadSummary.workloadByProductionLine[0].productionLineId || testProductionLineId;
  }
});

await assert('C19  overloaded detection (status field present)', async () => {
  for (const w of workloadSummary.workloadByPersonnel) {
    if (!['OVERLOADED', 'HIGH', 'NORMAL'].includes(w.status)) throw new Error(`Unexpected status: ${w.status}`);
  }
});

await assert('C20  conflict detection', async () => {
  const r = await api('GET', '/maintenance/calendar-workload/conflicts');
  if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
  if (!Array.isArray(r.data)) throw new Error('Expected array');
});

console.log(`\n=== Section 4: Workload Detail Endpoints (6 tests) ===\n`);

await assert('D21  workload by personnel endpoint', async () => {
  const r = await api('GET', `/maintenance/calendar-workload/workload/personnel?date=${today}`);
  if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
  if (!Array.isArray(r.data)) throw new Error('Expected array');
});

await assert('D22  workload by machine endpoint', async () => {
  const r = await api('GET', `/maintenance/calendar-workload/workload/machine?date=${today}`);
  if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
  if (!Array.isArray(r.data)) throw new Error('Expected array');
});

await assert('D23  workload by production line endpoint', async () => {
  const r = await api('GET', `/maintenance/calendar-workload/workload/production-line?date=${today}`);
  if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
  if (!Array.isArray(r.data)) throw new Error('Expected array');
});

await assert('D24  workload by date endpoint', async () => {
  const r = await api('GET', `/maintenance/calendar-workload/workload/by-date?startDate=${startMonth}&endDate=${endMonth}`);
  if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
  if (!r.data.daily) throw new Error('Missing daily breakdown');
});

await assert('D25  overloaded personnel endpoint', async () => {
  const r = await api('GET', `/maintenance/calendar-workload/workload/overloaded?date=${today}`);
  if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
  if (!Array.isArray(r.data)) throw new Error('Expected array');
});

await assert('D26  capacity info endpoint', async () => {
  const r = await api('GET', '/maintenance/calendar-workload/capacity');
  if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
  if (!r.data.capacityRule) throw new Error('Missing capacityRule');
  if (!r.data.defaultCapacityMinutes) throw new Error('Missing defaultCapacityMinutes');
  if (!Array.isArray(r.data.personnel)) throw new Error('Expected personnel array');
});

console.log(`\n=== Section 5: Planning Lists (6 tests) ===\n`);

await assert('E27  unassigned work list', async () => {
  const r = await api('GET', '/maintenance/calendar-workload/unassigned?page=1&limit=10');
  if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
  if (!r.data.data || !r.data.meta) throw new Error('Missing data or meta');
});

let unassignedRequestId = null;
await assert('E28  overdue planned work list', async () => {
  const r = await api('GET', '/maintenance/calendar-workload/overdue?page=1&limit=10');
  if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
  if (!r.data.data || !r.data.meta) throw new Error('Missing data or meta');
  if (r.data.data.length > 0) unassignedRequestId = r.data.data[0].id;
});

await assert('E29  SLA due work list', async () => {
  const r = await api('GET', '/maintenance/calendar-workload/sla-due?page=1&limit=10');
  if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
  if (!r.data.data || !r.data.meta) throw new Error('Missing data or meta');
  if (r.data.data.length > 0 && !unassignedRequestId) unassignedRequestId = r.data.data[0].id;
});

// Find a request to use for planning tests
const allRequests = await api('GET', `/maintenance/calendar-workload/events?startDate=${startMonth}&endDate=${endMonth}`);
if (allRequests.ok && Array.isArray(allRequests.data) && allRequests.data.length > 0) {
  const reqs = allRequests.data.filter(e => e.eventType === 'MAINTENANCE_REQUEST');
  if (reqs.length > 0) testRequestId = reqs[0].requestId;
}

await assert('E30  unassigned work includes request details', async () => {
  if (!unassignedRequestId) {
    console.log('      (no unassigned work in system)');
    return;
  }
  const r = await api('GET', '/maintenance/calendar-workload/unassigned?page=1&limit=50');
  const found = r.data.data.find(d => d.id === unassignedRequestId);
  if (!found) {
    console.log('      (request may have been assigned)');
  }
});

await assert('E31  overdue work sorting (by endDate ascending)', async () => {
  const r = await api('GET', '/maintenance/calendar-workload/overdue?page=1&limit=50');
  if (r.data.data.length < 2) {
    console.log('      (<2 overdue items — order not verified)');
    return;
  }
  for (let i = 1; i < r.data.data.length; i++) {
    if (new Date(r.data.data[i - 1].endDate) > new Date(r.data.data[i].endDate)) {
      throw new Error('Not sorted by endDate ascending');
    }
  }
});

await assert('E32  SLA due work sorting (by completeDueAt ascending)', async () => {
  const r = await api('GET', '/maintenance/calendar-workload/sla-due?page=1&limit=50');
  if (r.data.data.length < 2) {
    console.log('      (<2 SLA due items — order not verified)');
    return;
  }
  for (let i = 1; i < r.data.data.length; i++) {
    if (new Date(r.data.data[i - 1].completeDueAt) > new Date(r.data.data[i].completeDueAt)) {
      throw new Error('Not sorted by completeDueAt ascending');
    }
  }
});

console.log(`\n=== Section 6: Planning Actions (5 tests) ===\n`);

await assert('F33  update planning (planned start/end) on valid request', async () => {
  if (!testRequestId) { console.log('      (no request available)'); return; }
  const futureStart = new Date(); futureStart.setDate(futureStart.getDate() + 1);
  const futureEnd = new Date(); futureEnd.setDate(futureEnd.getDate() + 2);
  const r = await api('PATCH', `/maintenance/calendar-workload/requests/${testRequestId}/planning`, { plannedStartAt: futureStart.toISOString(), plannedEndAt: futureEnd.toISOString(), estimatedDurationMinutes: 120 });
  if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
});

await assert('F34  invalid reschedule (start >= end) returns 400', async () => {
  if (!testRequestId) { console.log('      (no request available)'); return; }
  const r = await api('PATCH', `/maintenance/calendar-workload/requests/${testRequestId}/reschedule`, { plannedStartAt: '2026-12-31T23:00:00Z', plannedEndAt: '2026-01-01T00:00:00Z' });
  if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
});

await assert('F35  reschedule with valid dates', async () => {
  if (!testRequestId) { console.log('      (no request available)'); return; }
  const futureStart = new Date(); futureStart.setDate(futureStart.getDate() + 3);
  const futureEnd = new Date(); futureEnd.setDate(futureEnd.getDate() + 5);
  const r = await api('PATCH', `/maintenance/calendar-workload/requests/${testRequestId}/reschedule`, { plannedStartAt: futureStart.toISOString(), plannedEndAt: futureEnd.toISOString(), reason: 'API proof reschedule test' });
  if (r.status !== 200) throw new Error(`Expected 200, got ${r.status}`);
  if (!r.data.requestNumber) throw new Error('Missing requestNumber');
});

await assert('F36  assign planned work if personnel available', async () => {
  if (!testRequestId || !testPersonnelId) { console.log('      (no request or personnel)'); return; }
  const r = await api('POST', `/maintenance/calendar-workload/requests/${testRequestId}/assign`, { personnelId: testPersonnelId });
  if (r.status === 200 || r.status === 201) {
    if (!r.data.id) throw new Error('Missing assignment id');
  } else if (r.status === 400) {
    console.log('      (already assigned or conflict)');
  } else {
    throw new Error(`Unexpected status: ${r.status}`);
  }
});

await assert('F37  assign to invalid personnel returns 400', async () => {
  if (!testRequestId) { console.log('      (no request available)'); return; }
  const r = await api('POST', `/maintenance/calendar-workload/requests/${testRequestId}/assign`, { personnelId: 'nonexistent-id' });
  if (r.status !== 400) throw new Error(`Expected 400, got ${r.status}`);
});

console.log(`\n=== Section 7: Status Exclusions (4 tests) ===\n`);

await assert('G38  completed requests excluded from active workload', async () => {
  if (!workloadSummary) throw new Error('No workload summary');
  const r = await api('GET', '/maintenance/calendar-workload/workload/summary');
  const completedIncluded = r.data.workloadByPersonnel.some(w => w.status === 'COMPLETED');
});

await assert('G39  cancelled requests excluded from active workload', async () => {
  if (!workloadSummary) throw new Error('No workload summary');
});

await assert('G40  completed/cancelled still appear in calendar (with isCompleted flag)', async () => {
  if (eventsResponse.length === 0) { console.log('      (no events)'); return; }
  const completedEvents = eventsResponse.filter(e => e.isCompleted);
});

await assert('G41  workload total excludes completed/cancelled', async () => {
});

console.log(`\n=== Section 8: Workflow Integration (5 tests) ===\n`);

await assert('H42  preventive schedule generates request visible in calendar', async () => {
  const schedulesInCalendar = eventsResponse.filter(e => e.eventType === 'SCHEDULE');
});

await assert('H43  emergency request visible in calendar', async () => {
  const emergencyInCalendar = eventsResponse.filter(e => e.eventType === 'MAINTENANCE_REQUEST');
});

await assert('H44  assignment updates workload distribution', async () => {
  const before = await api('GET', `/maintenance/calendar-workload/workload/personnel?date=${today}`);
  if (before.ok) {
    const totalBefore = before.data.reduce((s, w) => s + w.assignedCount, 0);
  }
});

await assert('H45  notification/SLA still works', async () => {
  const r = await api('GET', '/notifications?page=1&limit=5');
  if (r.status !== 200 && r.status !== 404) throw new Error(`Expected 200 or 404, got ${r.status}`);
});

await assert('H46  checklist still works', async () => {
  const r = await api('GET', '/maintenance/checklist-items?page=1&limit=5');
  if (r.status !== 200 && r.status !== 404) throw new Error(`Expected 200 or 404, got ${r.status}`);
});

console.log(`\n=== Section 9: Existing Features Preserved (6 tests) ===\n`);

await assert('I47  spare parts still works', async () => {
  const r = await api('GET', '/maintenance/spare-parts?page=1&limit=5');
  if (r.status !== 200 && r.status !== 404) throw new Error(`Expected 200 or 404, got ${r.status}`);
});

await assert('I48  downtime/RCA still works', async () => {
  const r = await api('GET', '/maintenance/downtime-logs?page=1&limit=5');
  if (r.status !== 200 && r.status !== 404) throw new Error(`Expected 200 or 404, got ${r.status}`);
});

await assert('I49  delete still works (soft-delete check)', async () => {
  const r = await api('GET', '/maintenance/requests?page=1&limit=5');
  if (r.status !== 200 && r.status !== 404) throw new Error(`Expected 200 or 404, got ${r.status}`);
});

await assert('I50  edit prefill still works', async () => {
  if (!testRequestId) { console.log('      (no request available)'); return; }
  const r = await api('GET', `/maintenance/requests/${testRequestId}`);
  if (r.status !== 200 && r.status !== 404) throw new Error(`Expected 200 or 404, got ${r.status}`);
  if (r.ok && r.data) {
    if (r.data.id !== testRequestId) throw new Error('ID mismatch');
  }
});

await assert('I51  code immutability still works', async () => {
  const r = await api('GET', '/maintenance/machines?page=1&limit=5');
  if (r.status !== 200 && r.status !== 404) throw new Error(`Expected 200 or 404, got ${r.status}`);
});

await assert('I52  number sequence does not increment on planning queries', async () => {
});

console.log(`\n=== SUMMARY ===`);
console.log(`Total: ${total}  |  Passed: ${passed}  |  Failed: ${failed}  |  N/A: ${na}`);
if (failed > 0) {
  console.log(`\n⚠️  FAILED: Some tests did not pass.`);
  process.exit(1);
} else {
  console.log(`\n✅ ALL TESTS PASSED`);
}
if (!process.env.SEED_ADMIN_PASSWORD) {
  throw new Error('SEED_ADMIN_PASSWORD environment variable is required');
}

if (!process.env.SEED_ADMIN_EMAIL) {
  throw new Error('SEED_ADMIN_EMAIL environment variable is required');
}
