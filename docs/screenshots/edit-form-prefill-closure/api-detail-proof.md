# API Detail Proof

This fix ensures every edit form fetches the full record via the detail API endpoint before rendering form fields.

| Page | Detail Endpoint | Detail Fetch Added/Fixed |
|------|----------------|--------------------------|
| Companies | GET /companies/:id | Added |
| Branches | GET /branches/:id | Added |
| Departments | GET /departments/:id | Added |
| Users | GET /users/:id | Added |
| Roles | GET /roles/:id | Fixed (was `res.code`, now `res.data.code`) |
| Numbering | GET /numbering/:id | Added |
| Notification Rules | GET /notifications/rules/:id | Added |
| Warehouses (list) | GET /inventory/warehouses/:id | Added |
| Warehouses (detail) | GET /inventory/warehouses/:id | Fixed (was `res.companyId`, now `res.data.companyId`) |
| Locations | GET /inventory/locations/:id | Fixed (was `res.warehouseId`, now `res.data.warehouseId`) |
| Movements | GET /inventory/movements/:id | Fixed (was `res.notes`, now `res.data.notes`) |
| Adjustments | GET /inventory/adjustments/:id | Fixed (was `res.reason`, now `res.data.reason`) |
| Product Categories | GET /product-categories/:id | Fixed (was `catRes.code`, now `catRes.data.code`) |

All detail endpoints were verified to exist and return complete entity data.
