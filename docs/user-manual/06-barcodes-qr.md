# Barcodes and QR

> User Manual — Section 6

## Purpose

Generate and manage barcode and QR code labels for products, machines, locations, and maintenance.

## Who Uses This

Inventory and maintenance teams.

## Barcode Records

1. Navigate to **Barcodes** in sidebar
2. View all generated barcode/QR records

## Barcode Templates

1. Navigate to **Templates** under Barcodes
2. Templates define label layout (size, fields, format)
3. Activate/deactivate templates as needed

## Generating Labels

1. Use **Generate Labels** to create barcode/QR labels
2. Choose the template and target entity type
3. Labels are created with unique codes

## Scanning

1. Use **Scan** to record a scan event
2. Supported scan types:
   - Inventory count
   - Machine check
   - Maintenance
   - Part lookup
3. Scan history is recorded in **Scans**

## Print Jobs

1. Navigate to **Print Jobs** under Barcodes
2. View print job status and history
3. Labels are printed via browser print (print-to-PDF)

## Expected Result

- Barcode records generate with unique codes
- Scan events are logged
- Labels can be printed

## Permissions Required

- Barcodes: `barcodes:read`

## Related API Routes

- `GET /api/v1/barcodes`
- `GET /api/v1/barcodes/templates`
- `GET /api/v1/barcodes/scans`
- `GET /api/v1/barcodes/labels`
- `GET /api/v1/barcodes/print-jobs`
