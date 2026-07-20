# Installation — Windows Local Runtime

> Admin Guide — Section 1

## System Requirements

| Component | Requirement |
|-----------|-------------|
| OS | Windows 10/11 or Windows Server 2019+ |
| Node.js | v22.17.1 or later |
| npm | v11.2.1 or later |
| SQL Server | SQL Server 2019+ (Instance: WINCC, Port: 50079) |
| Database | ATsoftERP_DB (must exist) |
| RAM | 8 GB minimum, 16 GB recommended |
| Disk | 2 GB free for application, additional for database |

## First-Time Setup

### 1. Install Node.js

Download and install Node.js v22.17.1 from https://nodejs.org.

### 2. Clone the Repository

```powershell
git clone https://github.com/attef7474-byte/ATsoftERP.git
cd ATsoftERP
```

### 3. Install Dependencies

```powershell
npm install
```

### 4. Configure Database Connection

Create a `.env` file in the project root (do **not** commit this file):

```
DATABASE_URL=sqlserver://localhost:50079;database=ATsoftERP_DB;user=your_user;password=your_password;trustServerCertificate=true;encrypt=false
```

Replace `your_user` and `your_password` with actual SQL Server credentials.

### 5. Generate Prisma Client

```powershell
npx prisma generate --schema apps/api/prisma/schema.prisma
```

### 6. Build the API

```powershell
npm run build:api
```

### 7. Build the Web App

```powershell
npm run build:web
```

### 8. Start the API

```powershell
npm run start:dev --workspace apps/api
```

Verify: Open http://localhost:4000/api/v1/health — should return `{"status":"ok"}`.

### 9. Start the Web App

```powershell
npm run dev --workspace apps/web
```

Verify: Open http://localhost:3000 — should show the login page.

## Expected Result

- API running on port 4000
- Web app running on port 3000
- Swagger docs at http://localhost:4000/api/docs
- Login page at http://localhost:3000/login

## Troubleshooting

See `08-troubleshooting.md` for common issues.
