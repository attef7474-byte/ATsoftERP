# Analysis — Batch E: Spare Parts Catalog & Component/Machine Links

## Approach Decision: Approach C

Create `SparePart` as a **maintenance-specific catalog entity** with an optional `productId` link for future inventory integration. Rationale:

- `Product` already exists as an inventory item with stock balances and movements — we must NOT touch inventory.
- `MachinePart` links `Product` to `Machine` — different concern (parts attached to machines).
- Spare parts need maintenance-specific fields (reorderPoint, isCritical, manufacturer, model) that don't belong on `Product`.
- Future integration: `SparePart.productId` can optionally reference a `Product` when inventory sync is needed.

## Audit Matrix

| Item | Exists | Complete | Missing | Batch E Action |
|------|--------|----------|---------|---------------|
| SparePart catalog | No | — | Full model, module, CRUD | Create |
| Product/Item spare part support | Yes (Product) | Inventory model | SparePart productId link | Add optional productId |
| ComponentSparePart link | No | — | Full model, module, CRUD | Create |
| MachineSparePart link | No | — | Full model, module, CRUD | Create |
| MachineComponent relation | Yes | MachineComponent model | spareParts relation | Add relation |
| Machine relation | Yes | Machine model | spareParts relation | Add relation |
| Backend module | No | — | 3 modules | Create |
| CRUD endpoints | No | — | REST endpoints | Create |
| DTO validation | No | — | class-validator DTOs | Create |
| Duplicate code validation | No | — | code unique | Create |
| Component link validation | No | — | duplicate componentId+sparePartId | Create |
| Machine link validation | No | — | duplicate machineId+sparePartId | Create |
| Frontend Spare Parts page | No | — | List/create/edit/detail | Create |
| Component parts section | No | — | Linked parts on component page | Create |
| Machine parts section | No | — | Linked parts on machine page | Create |
| Permissions | No | — | 13 new permissions | Create |
| i18n AR/EN | No | — | 30+ keys each | Add |
| F9 adapter | No | — | sparePart lookup adapter | Create |
| API proof | No | — | 20 tests | Create |
| Browser proof | No | — | Playwright tests | Create |
