# Inventory Domain Rules

## 1. Warehouses and Locations

* Warehouses belong to a company (and branch where applicable); locations belong to a warehouse.
* Warehouse lists and location lists are tenant-scoped queries — never fetch by `id` alone.
* The warehouses list endpoint is `GET /inventory/warehouses` (do not use a non-existent `/warehouses` route).
* `findLocations` returns a plain array (not `{ data }`); map responses accordingly.

## 2. Inventory Documents

* All quantity changes originate from an authorized inventory document (receipt, issue, return, transfer, adjustment, count, reconciliation).
* Each document carries the tenant context, source references, and audit metadata.

## 3. Balances Are Derived Transactional Truth

* Inventory balances are derived from the ledger of authorized movements — never an independent manual fact.
* A movement and its balance effect update atomically in one transaction.
* Cached totals are allowed only with a documented reconciliation strategy.
* Aggregations in reports come from authoritative movement records.

## 4. No Negative Balances

* Validate available quantity before any issue or consumption.
* Prevent negative inventory in every flow.
* Physical-count and adjustment documents that must correct negative conditions require an approved, documented workflow and full audit.

## 5. Source-Document Requirement

* Do not directly edit an inventory balance without an authorized source transaction.
* Every balance change must be traceable to its document, user, timestamp, and reason.

## 6. Transactions and Locking

* Multi-movement documents (issue, transfer, count) run in database transactions.
* Prevent double-posting: repeated submission of the same document must not create duplicate movements.
* Lock enforcement: a document being posted must not be re-posted concurrently; apply locks or optimistic guards where applicable.

## 7. Spare-Part Warehouse Restriction

* Spare parts issue from their defined warehouses; validate warehouse compatibility with the part and the tenant.
* Reject issues from incompatible warehouses with a localized error.

## 8. Document Types

Preserve and harden the established flows:

* Issue (with requester, approver, issuer, receiver).
* Return (reverse of issue, traceable to the original document).
* Transfer (between warehouses/locations, atomically decrement/increment).
* Adjustment (reason-required, audited).
* Receipt (inbound, with source document).
* Physical count (count vs balance, variance review).
* Reconciliation (post-count balance correction).

## 9. Part Condition

* Spare parts carry a condition state; condition changes are audited.
* Removed/replaced parts retain their condition and are tracked in replacement history.

## 10. Installation and Replacement

* Installation creates a movement, updates the balance, and records the installed part on the machine/component in one transaction.
* Replacement atomically records the removed part (removal) and the installed part (installation).
* Record cost ownership and machine/component context.

## 11. Cost Traceability

* Each movement carries its cost-relevant data; costs aggregate from the atomic movement, never from duplicated facts.
* Cost overrides require permission and audit (previous and new values).

## 12. Idempotency and No Duplicate Movement Posting

* Duplicate-submission tests must cover every posting flow.
* A posted document cannot be posted twice; the system returns a stable localized error or an idempotent success with no new movement.
