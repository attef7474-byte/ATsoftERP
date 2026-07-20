# API Summary — ATsoft ERP

> REST API documentation for Batch 39

## Base URL

```
http://localhost:4000/api/v1
```

## Interactive Docs

Swagger UI: http://localhost:4000/api/docs

## Authentication

- JWT Bearer token in the `Authorization` header
- Only authentication endpoint is public

## Key Endpoints

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/login | Log in with email + password |

### Users & Permissions

| Method | Path | Description |
|--------|------|-------------|
| GET | /users | List users |
| GET | /users/:id | Get user by ID |
| GET | /roles | List roles |
| GET | /permissions | List permissions |
| GET | /permissions/matrix | Permission matrix |

### Inventory

| Method | Path | Description |
|--------|------|-------------|
| GET | /warehouses | List warehouses |
| GET | /product-categories | List product categories (tree) |
| GET | /products | List products |
| GET | /products/:id | Get product by ID |
| GET | /inventory/balances | Inventory balances |
| GET | /inventory/movements | Inventory movements |
| GET | /inventory/counts | Inventory counts |

### Maintenance

| Method | Path | Description |
|--------|------|-------------|
| GET | /maintenance/machines | List machines |
| GET | /maintenance/machines/:id | Get machine with card |
| GET | /maintenance/requests | Maintenance requests |
| GET | /maintenance/tasks | Maintenance tasks |
| GET | /maintenance/preventive | Preventive schedules |
| GET | /maintenance/downtime | Downtime events |

### Barcodes

| Method | Path | Description |
|--------|------|-------------|
| GET | /barcodes | List barcode records |
| GET | /barcodes/templates | Barcode templates |
| GET | /barcodes/scans | Scan history |
| POST | /barcodes/scan | Record a scan |

### Reports

| Method | Path | Description |
|--------|------|-------------|
| GET | /reports | List available reports |
| GET | /reports/:type | Report data by type |

### Health

| GET | /health | Health check |
| GET | /health/detailed | Detailed health check |

### Search

| GET | /search?q=query | Unified search |
