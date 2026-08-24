#!/usr/bin/env node
/**
 * Production database backup script for ATsoft ERP.
 *
 * Usage (Windows):
 *   node tools/backup/backup-database.mjs
 *
 * Environment variables:
 *   DB_SERVER  - SQL Server host (default: localhost)
 *   DB_PORT    - SQL Server port (default: 1433)
 *   DB_NAME    - Database name (default: ATsoftERP_DB)
 *   DB_USER    - SQL Server user (default: sa)
 *   DB_PASSWORD - SQL Server password (required)
 *   BACKUP_DIR - Backup directory (default: ./backups)
 *
 * Requires sqlcmd to be available on PATH.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DB_SERVER = process.env.DB_SERVER || 'localhost';
const DB_PORT = process.env.DB_PORT || '1433';
const DB_NAME = process.env.DB_NAME || 'ATsoftERP_DB';
const DB_USER = process.env.DB_USER || 'sa';
const DB_PASSWORD = process.env.DB_PASSWORD;
const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve('./backups');

if (!DB_PASSWORD) {
  console.error('FATAL: DB_PASSWORD environment variable is required for backup.');
  process.exit(1);
}

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
const backupFile = path.join(BACKUP_DIR, `${DB_NAME}_${timestamp}.bak`);

console.log(`Starting backup of ${DB_NAME} from ${DB_SERVER}:${DB_PORT}...`);
console.log(`Backup file: ${backupFile}`);

try {
  const sql = `BACKUP DATABASE [${DB_NAME}] TO DISK = N'${backupFile.replace(/\\/g, '\\\\')}' WITH FORMAT, STATS = 10;`;
  const cmd = `sqlcmd -S ${DB_SERVER},${DB_PORT} -U ${DB_USER} -P "${DB_PASSWORD}" -C -Q "${sql}"`;
  execSync(cmd, { stdio: 'inherit', timeout: 300_000 });
  console.log(`Backup completed successfully: ${backupFile}`);

  const stat = fs.statSync(backupFile);
  console.log(`Backup size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
} catch (error) {
  console.error('Backup failed:', error.message);
  process.exit(1);
}
