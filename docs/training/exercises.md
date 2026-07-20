# Training Exercises

> Practical exercises for ATsoft ERP training

## Exercise 1: Login and Navigation (All users)

1. Open http://localhost:3000
2. Log in with your credentials
3. Navigate to three different modules using the sidebar
4. Switch the language to Arabic and back
5. Press F9 and search for anything

## Exercise 2: Inventory (Inventory team)

1. Go to **Products** and find a product
2. Check its balance in **Balances**
3. View its movement history in **Movements**
4. Find the warehouse where it's stored in **Warehouses**

## Exercise 3: Maintenance (Maintenance team)

1. Go to **Machines** and find a machine
2. View its card and documents
3. Check the **Dashboard** for open requests
4. View **Tasks** assigned to you

## Exercise 4: Reports (All users)

1. Go to **Reports**
2. Open the **Inventory Overview** report
3. Export it as CSV
4. Export it as Excel
5. Try the **Print** button

## Exercise 5: Barcodes (All users)

1. Go to **Barcodes**
2. View available **Templates**
3. Generate a label for a product
4. View the **Scans** history

## Exercise 6: Search (All users)

1. Press F9
2. Search for a product name
3. Search for a machine
4. Search for a warehouse

## Exercise 7: Admin (Admins only)

1. List all users via: `GET /api/v1/users`
2. List all roles: `GET /api/v1/roles`
3. Check the permission matrix: `GET /api/v1/permissions/matrix`
4. Run the health check script
5. Run the smoke test script
