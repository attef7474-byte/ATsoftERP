# F9 Lookup Adapter Proof — Operational Receipt

## Adapter Added
File: `apps/web/src/components/f9/lookup-adapters.ts`

```typescript
export const operationalReceiptAdapter: LookupAdapter<OperationalReceipt> = {
  endpoint: '/inventory/operational-receipts',
  displayLabel: (r) => `[${r.code}] ${r.reason || r.id}`,
  searchFields: ['code', 'reason'],
  columns: [
    { key: 'code', header: 'Code' },
    { key: 'warehouse', header: 'Warehouse', render: (r) => r.warehouse?.name || '-' },
    { key: 'status', header: 'Status', render: (r) => r.status },
  ],
};
```

## Exported From
`apps/web/src/components/f9/index.ts` — added to the named export block.
