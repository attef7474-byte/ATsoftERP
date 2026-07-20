# Inventory, Warehouse, Products, and Counts

> User Manual — Section 4

## Purpose

Manage warehouses, locations, products, inventory balances, movements, and counts.

## Who Uses This

Inventory team.

## Warehouses

### View Warehouses

1. Navigate to **Warehouses** in sidebar
2. The list shows all warehouses

### Fields

- Name
- Code
- Location / Address
- Status (Active/Inactive)

## Warehouse Locations

1. Navigate to **Locations** inside Inventory
2. Each location belongs to a warehouse
3. Locations can be aisles, racks, bins, etc.

## Products

### View Products

1. Navigate to **Products** in sidebar
2. The list shows all products with code, name, category, unit

### Product Categories

1. Navigate to **Product Categories**
2. Categories are organized in a tree hierarchy

## Inventory Balances

Shows current stock levels per product per warehouse/location.

1. Navigate to **Balances** under Inventory
2. View quantity on hand per product/location
3. Summary view available

## Inventory Movements

Records of stock moving in or out.

1. Navigate to **Movements** under Inventory
2. Shows type (in/out), product, quantity, date, reference

## Inventory Counts

Physical count records to reconcile with system balances.

1. Navigate to **Counts** under Inventory
2. View count plans, status, and results

## Expected Result

- Lists show current inventory data
- Balances reflect real stock quantities
- Movements show recent transactions

## Permissions Required

- Warehouses: `warehouses:read`
- Products: `products:read`
- Inventory (balances, movements, counts): `inventory:read`

## Related API Routes

- `GET /api/v1/inventory/warehouses`
- `GET /api/v1/inventory/locations`
- `GET /api/v1/products`
- `GET /api/v1/inventory/balances`
- `GET /api/v1/inventory/movements`
- `GET /api/v1/inventory/counts`
