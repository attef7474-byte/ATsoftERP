# Unified print: P0 maintenance checkpoint

Status: **PASS for P0 maintenance; PARTIAL overall rollout.** The owner accepted the reference and subsequently all twelve P0 native previews: **فحصت التقارير الاثني عشر؛ كلها سليمة**. Automated browser control remains unavailable; no automated native screenshot is claimed. Production has not been replaced.

## Task and repository context

Resume the authorized unified print rollout after reference acceptance, in the prescribed P0 order. Branch `main`, HEAD `54e3706f98c8ff7aa7f48febe12611015c3e29fe`. The 25 files recorded before print work, including employee-save and LAN-login repairs, remain byte-for-byte unchanged. No Git write operations or database writes are part of this checkpoint.

## Completed scope

The twelve routes following the reference now use dedicated business documents: maintenance overview, KPIs, downtime, costs, schedules, assets, machine log, parts usage, upcoming preventive, overdue preventive, parts, and low stock. Their print columns, filters, units, totals and orientation were reviewed against the current page, service and schema. See the [page matrix](../print/ATsoftERP-print-page-matrix.md) and [column rules](../print/ATsoftERP-print-column-rules.md).

Successful screen loads capture data, applied parameters, readable lookup labels and authenticated scope. Out-of-order responses cannot replace newer snapshots. Print/PDF actions share preparation and use the accepted document runtime. Paginated reports collect matching results in bounded pages, reject duplicates/inconsistent totals and refuse more than 500 rows. Overview/KPIs reuse successful bounded summary responses. Costs deliberately use an explicitly partial current-page extract.

## Canonical report limitations found

These existing business contracts were preserved and made visible; they were not repaired through a print task:

* Overview and KPI metrics apply different date and selection scopes. Each section or metric states its actual scope. Legacy costs are not certified ledger values.
* The costs endpoint pages cost entries but repeatedly supplies the first ten parts-usage records. Parts ignore the selected date period; spare-part selection does not narrow cost entries. Printing states **partial extract**, separates streams and full-scope totals, and never pretends to collect all results.
* Schedule due indicators can replace the selected due horizon. They are not additive partitions of the filtered list.
* Upcoming `dueWithinWeek` can include overdue schedules, and `totalActiveSchedules` is only its current window. Overdue compliance uses an overdue-only denominator. These misleading summary cards are excluded from paper; matching schedule counts remain canonical. Existing screen/API behavior is unchanged.
* Parts API returns MachinePart.quantity; the legacy screen uses a nonexistent stockQuantity/status. Paper uses the real quantity and omits invented status. Its status selector is ignored by the backend and is identified as unapplied when selected.
* Machine-parts quantities are parts-list values, not InventoryBalance. Low stock uses a fixed quantity below 10, not item minStock. Mixed-unit quantity sums are omitted. Currency is not supplied by the legacy cost reports and is not invented.
* Assets include company assets shared across branches. Active/inactive counters can override the selected status; the document explains this.

## Evidence

Full Web regression: **102 suites / 2067 tests PASS**. The print scope accounts for **15 suites / 97 tests**, including actual React page handlers, readable filters, shared Print/PDF preparation, multi-source failure, stale responses, duplicate rows, limits and pagination failures. Native DOM boundaries are mocked in these tests; no browser proof is inferred.

Web TypeScript and API TypeScript checks exited 0. i18n: **6977 EN / 6977 AR keys**, 22 namespaces per language, no empty values. Route contract: **1147 matched; 0 malformed/unresolved/mismatches**. UI baseline: **99 checks PASS**. Permission UI, raw-key and tracked-secret checks pass. Dynamic translation warnings remain explicit in the raw-key log. The isolated Web build and final source hashes are recorded in `.tmp/unified-print/p0-evidence.json`; do not substitute the older reference manifest.

Standalone PDFs use the actual PrintDocument component and shared CSS, WeasyPrint 70.0, and PyMuPDF rasterization. Real authorized canonical GET responses and clearly labelled in-memory fixtures are separate. No fixture was inserted into Production. Every report has AR/EN actual and empty proof; table reports also have 65-row multi-page fixtures. Overview/KPIs span two pages with actual data; real assets span ten pages. Dimensions/text bounds pass. Actual parts exceed 500 rows; the unfiltered request is refused, and the actual PDF explicitly narrows search to an existing business code. Business counters are unchanged before/after the reads.

Representative output: [downtime](../print/proofs/maintenance-downtime-multipage-ar.pdf), [partial cost extract](../print/proofs/maintenance-costs-composite-en.pdf), [actual assets](../print/proofs/maintenance-assets-actual-ar.pdf), [parts usage with units](../print/proofs/maintenance-parts-usage-multipage-en.pdf). These are renderer outputs, not browser screenshots or native saved PDFs.

## Safety and remaining scope

No database models/migrations, API endpoints, permissions, operational routes, production orders, inventory transactions, material consumption, production runs or finished-goods receipts were changed. Read authorization continues through existing canonical endpoints and backend tenant guards. Native preview proof is manual owner confirmation for every P0 page on build d7FmkeP9zeBH2auFxIY2f. Production deployment, saved native PDF files and physical output remain unverified. P1 inventory/system and cross-domain reports, then justified operational documents, remain the next rollout stages. Barcode/label flows remain specialized.

Git is dirty from preserved prior repairs plus print source/tests/documentation/proof artifacts. No clean-tree or full-application completion claim is made.

The final source-identical review build exited 0 with 194/194 pages. Windows emitted EPERM while copying a dependency symlink into isolated standalone tracing output; webpack also emitted dependency-cache snapshot warnings. The full standalone deployment package is not certified by this review build. The running custom review server returned health/login 200 and blocked a business POST locally with 403 before it reached the API. Existing API tenant/permission regressions: 3 suites / 27 tests PASS. Canonical GET probes across 15 endpoints returned anonymous 401 and missing-context 403; foreign-machine queries were rejected or produced empty selected aggregates under explicit tenant-scoped summary contracts. No live denied-role or write test is claimed.
