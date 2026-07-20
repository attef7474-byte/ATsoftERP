# API / Web Startup

> Admin Guide — Section 2

## Starting the API

```powershell
# From the project root:
npm run start:dev --workspace apps/api
```

Expected output:
```
[Nest] INFO  - Nest application successfully started
```

The API listens on http://localhost:4000.

### API Prefix

All API routes are prefixed with `/api/v1`. For example:
- Health: http://localhost:4000/api/v1/health
- Login: POST http://localhost:4000/api/v1/auth/login

### Swagger Documentation

Open http://localhost:4000/api/docs in your browser to see the interactive API documentation.

## Starting the Web App

```powershell
# From the project root:
npm run dev --workspace apps/web
```

Expected output:
```
Ready in X.Xs
http://localhost:3000
```

The web app listens on http://localhost:3000.

### Production Build

For production:

```powershell
npm run build:web
npm run start --workspace apps/web
```

## Verifying Both Services

```powershell
# Check API
curl http://localhost:4000/api/v1/health

# Check Web
curl http://localhost:3000

# Check Swagger
curl http://localhost:4000/api/docs
```
