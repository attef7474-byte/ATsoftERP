// R4N read-only: exact column metadata needed to author a matching FK.
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';

const rootEnv = path.resolve(__dirname, '../../../.env');
for (const line of fs.readFileSync(rootEnv, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1]] === undefined) process.env[m[1]] = v;
}

const prisma = new PrismaClient({ adapter: new PrismaMssql(process.env.DATABASE_URL!) });

async function main() {
  const cols = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE (TABLE_NAME = 'machine_parts' AND COLUMN_NAME IN ('id','machineId','productId','code','name'))
        OR (TABLE_NAME = 'spare_parts' AND COLUMN_NAME = 'id')
     ORDER BY TABLE_NAME, COLUMN_NAME`,
  );
  const existingFk = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT fk.name AS fk_name,
            OBJECT_NAME(fk.referenced_object_id) AS ref_table,
            COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS parent_col,
            COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS ref_col,
            fk.delete_referential_action_desc AS on_delete,
            fk.update_referential_action_desc AS on_update
     FROM sys.foreign_keys fk
     JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
     WHERE OBJECT_NAME(fk.parent_object_id) IN ('machine_parts','spare_parts','machine_spare_parts','component_spare_parts')
     ORDER BY fk.name`,
  );
  const idx = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT OBJECT_NAME(i.object_id) AS tbl, i.name AS idx_name, i.type_desc, i.is_unique
     FROM sys.indexes i
     WHERE OBJECT_NAME(i.object_id) IN ('machine_parts','machine_spare_parts','component_spare_parts')
       AND i.name IS NOT NULL AND i.type <> 0
     ORDER BY tbl, i.name`,
  );
  console.log(JSON.stringify({ columns: cols, foreignKeys: existingFk, indexes: idx }, null, 2));
}

main().catch((e) => { console.error('FATAL', e); process.exitCode = 1; }).finally(() => prisma.$disconnect());