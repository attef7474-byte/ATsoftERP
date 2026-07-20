# Swagger Quickstart

> How to explore the API using Swagger UI

## Open Swagger

1. Ensure the API is running (http://localhost:4000)
2. Open: http://localhost:4000/api/docs
3. You will see the Swagger UI page listing all endpoints

## Authentication in Swagger

1. Click the **Authorize** button at the top
2. First, call `POST /auth/login` with valid credentials
3. Copy the returned JWT token
4. In the Authorize dialog, enter: `Bearer <token>`
5. Click **Authorize**
6. Now you can test authenticated endpoints

## Test an Endpoint

1. Find an endpoint (e.g., `GET /products`)
2. Click **Try it out**
3. Add any parameters or filters
4. Click **Execute**
5. View the response body and headers

## Key Endpoints to Try

- `GET /health` — no auth needed, quick validation
- `GET /roles` — list all roles
- `GET /permissions/matrix` — full permission matrix
- `GET /products?page=1&limit=10` — paginated products

## Notes

- Swagger UI is only available in development mode
- All POST endpoints require appropriate permissions
- The API returns JSON with pagination metadata
