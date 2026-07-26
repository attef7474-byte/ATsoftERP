# Edit Prefill Design Proof

## Design Pattern

Previously, edit modals used stale grid data:
```typescript
// OLD - stale data
openEdit(item: Entity) { setEditItem(item); setForm({ ...item }); }
```

Now, all edit modals fetch fresh data by ID:
```typescript
// NEW - fresh fetch
openEdit(id: string) {
  setLoadingDetail(true);
  const res = await api.get(`/path/${id}`);
  setForm(res);
  setLoadingDetail(false);
}
```

## Implementation per Page

| Page | Detail Endpoint | Loading State | Error Handling |
|------|----------------|---------------|----------------|
| production-lines | GET /maintenance/production-lines/:id | loadingDetail spinner | Toast on error |
| operation-types | GET /maintenance/operation-types/:id | loadingDetail spinner | Toast on error |
| cost-centers | GET /maintenance/cost-centers/:id | loadingDetail spinner | Toast on error |
| machine-categories | GET /maintenance/machine-categories/:id | loadingDetail spinner | Toast on error |
| machine-components | GET /maintenance/machine-components/:id | loadingDetail spinner | Toast on error |
| machine-parts | GET /maintenance/machine-parts/:id | loadingDetail spinner | Toast on error |
| spare-parts | GET /maintenance/spare-parts/:id | loadingDetail spinner | Toast on error |
| machines | GET /maintenance/machines/:id | loadingDetail spinner | Toast on error |
| personnel | GET /maintenance/personnel/:id | loadingDetail spinner | Toast on error |
| machine-responsibilities | GET /maintenance/machine-responsibilities/:id | loadingDetail spinner | Toast on error |
| checklist-items | GET /maintenance/checklist-items/:id | loadingDetail spinner | Toast on error |
| schedules | GET /maintenance/schedules/:id | loadingDetail spinner | Toast on error |
| tasks | GET /maintenance/tasks/:id | loadingDetail spinner | Toast on error |
| downtime-logs | GET /maintenance/downtime-logs/:id | loadingDetail spinner | Toast on error |
| requests | GET /maintenance/requests/:id | loadingDetail spinner | Toast on error |

## F9/Select Prefill

All F9 lookup components and select fields preload saved values because:
1. The detail endpoints return all relation IDs
2. React controlled components bind to form state
3. F9 adapters perform by-ID lookup to display names
