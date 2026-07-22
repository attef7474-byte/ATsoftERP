# Windows Batch Launcher — ATsoft ERP

## Purpose
Provide one-click startup of the ATsoft ERP application on Windows without Docker, using two CMD windows for clear log visibility.

## Files Created

| File | Description |
|------|-------------|
| `START_ATSOFT_ERP.bat` | Launches API + Web in separate CMD windows, opens browser |
| `CHECK_ATSOFT_ERP.bat` | Verifies all services are running and healthy |
| `STOP_ATSOFT_ERP_HELP.txt` | Instructions for safely stopping the application |
| `docs/runtime/windows-batch-launcher.md` | This documentation |

## How to Run

1. **Double-click** `START_ATSOFT_ERP.bat` in the project root.
2. Two CMD windows open:
   - **ATsoft ERP API - Port 4000** — backend logs
   - **ATsoft ERP Web - Port 3000** — frontend logs
3. A browser tab opens at `http://localhost:3000`.

## How to Check Status

Double-click `CHECK_ATSOFT_ERP.bat` or run from terminal:

```cmd
CHECK_ATSOFT_ERP.bat
```

It checks 6 items:
1. SQL Server port 50079 reachable
2. API listening on port 4000
3. Web listening on port 3000
4. API health endpoint returns OK
5. Swagger docs reachable
6. Web server returns 200

## Expected Ports

| Service | Port | URL |
|---------|------|-----|
| Backend API | 4000 | http://localhost:4000 |
| Swagger Docs | 4000 | http://localhost:4000/api/docs |
| Frontend Web | 3000 | http://localhost:3000 |
| SQL Server | 50079 | (internal) |

## Required Prerequisites

- **Node.js** (v18+) — verify with `node --version`
- **npm** — verify with `npm --version`
- **SQL Server** instance `WINCC` running on port `50079`
- **`.env` file** in `apps/api/.env` with correct `DATABASE_URL`
- **Dependencies installed** — run `npm install` from project root if not already done
- **Prisma client generated** — run `npm run build:api` if `dist/` is missing

## Troubleshooting

### API window closes immediately
- Check `apps/api/.env` exists with valid `DATABASE_URL`.
- Ensure SQL Server WINCC is running on port 50079.
- Run `npm run build:api` then try again.
- Check for port conflicts: `netstat -ano | findstr :4000`

### Web window closes immediately
- Check that `apps/web/package.json` exists.
- Ensure dependencies are installed (`npm install` from root).
- Check for port conflicts: `netstat -ano | findstr :3000`

### Port already in use
- Follow `STOP_ATSOFT_ERP_HELP.txt` to free the port.

### ERR_CONNECTION_REFUSED
- Ensure the API is fully started before accessing the Web.
- The launcher waits 8 seconds between starting API and Web.
- Check `CHECK_ATSOFT_ERP.bat` results.

### SQL Server unavailable
- Ensure SQL Server WINCC instance is running.
- Verify port 50079 is open: `netstat -ano | findstr :50079`
- Check `apps/api/.env` for correct `DATABASE_URL`.

### npm not recognized
- Install Node.js from https://nodejs.org.
- Restart your terminal after installation.

## Security Notes

- **Never commit** `.env` files or any file containing secrets.
- **Never print** `DATABASE_URL` or passwords in logs.
- **Never commit** cookies, tokens, or session data.
- The launcher scripts do **not** read or display secrets.
- Only `apps/api/.env` is checked for existence, never its contents.
- Stop scripts target specific PIDs only — no wildcard process killing.
