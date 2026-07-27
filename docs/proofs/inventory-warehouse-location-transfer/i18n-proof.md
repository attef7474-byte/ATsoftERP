# i18n Proof — Stock Transfers (Batch R)

## English Keys Added

File: `apps/web/src/lib/i18n/locales/en/inventory.ts`

```typescript
stockTransfers: 'Stock Transfers',
stockTransfer: 'Stock Transfer',
newStockTransfer: 'New Stock Transfer',
editStockTransfer: 'Edit Stock Transfer',
stockTransferCode: 'Document Number',
stockTransferDate: 'Document Date',
sourceWarehouse: 'From Warehouse',
sourceLocation: 'From Location',
destinationWarehouse: 'To Warehouse',
destinationLocation: 'To Location',
transferSubmit: 'Submit',
transferApprove: 'Approve',
transferReject: 'Reject',
transferPost: 'Post',
transferCancel: 'Cancel',
transferDelete: 'Delete',
transferSubmitted: 'Transfer submitted successfully',
transferApproved: 'Transfer approved',
transferRejected: 'Transfer rejected',
transferPosted: 'Transfer posted successfully',
transferCancelled: 'Transfer cancelled',
transferDeleted: 'Transfer deleted',
insufficientStockForTransfer: 'Insufficient stock for transfer',
confirmTransferSubmit: 'Submit this transfer?',
confirmTransferApprove: 'Approve this transfer?',
confirmTransferReject: 'Reject this transfer?',
confirmTransferPost: 'Post this transfer? This will deduct from source and add to destination.',
confirmTransferCancel: 'Cancel this transfer?',
confirmTransferDelete: 'Delete this transfer (DRAFT only)?',
noStockTransfers: 'No stock transfers found',
sourceDestinationMustDiffer: 'Source and destination must be different',
transferOutMovement: 'Transfer Out Movement',
transferInMovement: 'Transfer In Movement',
```

## Arabic Keys Added

File: `apps/web/src/lib/i18n/locales/ar/inventory.ts`

Same keys with Arabic translations.

## Reused Keys (no new entries needed)

| Key | Source | Purpose |
|-----|--------|---------|
| `common.create` | common.ts | "New Transfer" action bar |
| `common.edit` | common.ts | "Edit" action bar |
| `common.refresh` | common.ts | "Refresh" action bar |
| `common.confirm` | common.ts | Confirm dialog title |
| `common.back` | common.ts | Detail page back button |
| `common.status` | common.ts | Status label in detail |
| `common.createdAt` / `common.updatedAt` | common.ts | Audit timestamps |
| `inventoryCounting.company` | inventory.ts | Company label |
| `inventoryCounting.branch` | inventory.ts | Branch label |
| `inventoryCounting.adjSubmit` | inventory.ts | Submit action |
| `inventoryCounting.adjApprove` | inventory.ts | Approve action |
| `inventoryCounting.adjReject` | inventory.ts | Reject action |
| `inventoryCounting.adjPost` | inventory.ts | Post action |
| `inventoryCounting.adjCancel` | inventory.ts | Cancel action |
| `status.TRANSFER_IN` / `status.TRANSFER_OUT` | status | Movement types (already existed) |
| `details.readOnlyRecord` | core.ts | Read-only indicator |
| `details.overview` | core.ts | Detail tab |
| `InventoryStatusBadge` | Component | Status display (DRAFT/SUBMITTED/APPROVED/REJECTED/POSTED/CANCELLED) |

## Backend i18n

Backend error messages are returned in English as HTTP response messages (standard REST practice). The frontend `useTranslation()` hook maps them via locale files.

## Conclusion

33 new i18n keys added in English and Arabic. All existing common/inventory status keys are reused — no gaps. Frontend build confirms all keys resolve correctly.
