# Backend Proof — Operational Stock Receiving

## Module Structure
```
apps/api/src/modules/factory/inventory-operational-receipts/
├── dto/
│   ├── create-operational-receipt.dto.ts
│   ├── update-operational-receipt.dto.ts
│   └── operational-receipt-query.dto.ts
├── inventory-operational-receipts.controller.ts
├── inventory-operational-receipts.module.ts
└── inventory-operational-receipts.service.ts
```

## API Endpoints
| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | /api/v1/inventory/operational-receipts | create | Create receipt |
| GET | /api/v1/inventory/operational-receipts | read | List receipts |
| GET | /api/v1/inventory/operational-receipts/:id | read | Get receipt detail |
| PATCH | /api/v1/inventory/operational-receipts/:id | update | Update receipt |
| POST | /api/v1/inventory/operational-receipts/:id/submit | submit | Submit receipt |
| POST | /api/v1/inventory/operational-receipts/:id/approve | approve | Approve receipt |
| POST | /api/v1/inventory/operational-receipts/:id/reject | reject | Reject receipt |
| POST | /api/v1/inventory/operational-receipts/:id/post | post | Post receipt |
| POST | /api/v1/inventory/operational-receipts/:id/cancel | cancel | Cancel receipt |
| DELETE | /api/v1/inventory/operational-receipts/:id | delete-draft | Delete draft |
| POST | /api/v1/inventory/operational-receipts/:id/lines | update | Add line |
| PATCH | /api/v1/inventory/operational-receipts/:id/lines/:lineId | update | Update line |
| DELETE | /api/v1/inventory/operational-receipts/:id/lines/:lineId | update | Remove line |
| GET | /api/v1/inventory/operational-receipts/:id/summary | read | Get summary |

## Module Registration
- Imported and registered in `app.module.ts`
- Path: `inventory-operational-receipts`
