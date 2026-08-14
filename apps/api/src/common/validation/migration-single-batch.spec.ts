import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const migrationsRoot = join(__dirname, '..', '..', '..', 'prisma', 'migrations');

function collectMigrationFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectMigrationFiles(full));
    } else if (entry === 'migration.sql') {
      out.push(full);
    }
  }
  return out.sort();
}

function splitStatements(sql: string): string[] {
  return sql
    .split(/;(\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function leadingKeyword(statement: string): string {
  const stripped = statement.replace(/^\s*--[^\r\n]*\r?\n\s*/, '');
  const match = /^([A-Za-z]+)/.exec(stripped);
  return match ? match[1].toUpperCase() : '';
}

function stripLeadingComments(statement: string): string {
  return statement.replace(/^\s*(?:--[^\r\n]*\r?\n\s*)+/, '');
}

const DML_KEYWORDS = new Set(['UPDATE', 'INSERT', 'SELECT', 'DELETE', 'MERGE']);

/**
 * SQL Server compiles each batch as a whole before executing it. A DML
 * statement (UPDATE / INSERT / SELECT / DELETE) that references a column
 * introduced by `ALTER TABLE ... ADD` in the same batch fails with "Invalid
 * column name" at compile time, even when the ALTER appears earlier in the
 * file. DDL (CREATE INDEX, ALTER TABLE ADD CONSTRAINT) resolves its columns at
 * execution time and is safe. Prisma sends the whole migration.sql as one batch
 * and does not honor `GO`, so DML references to freshly added columns must be
 * deferred through `EXEC sys.sp_executesql`, which compiles at runtime after
 * the ALTER ran.
 */
describe('migration single-batch DML compile safety', () => {
  it('never runs DML against an ALTER-added column in the same batch', () => {
    const files = collectMigrationFiles(migrationsRoot);
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const file of files) {
      const sql = readFileSync(file, 'utf8');
      const statements = splitStatements(sql);

      const added = new Set<string>();
      for (const statement of statements) {
        const stripped = stripLeadingComments(statement);
        const alterMatch = /^ALTER\s+TABLE\s+(?:\[[^\]]+\]\.)?\[([A-Za-z0-9_]+)\]\s+ADD\s+(?!CONSTRAINT\b)\[([A-Za-z0-9_]+)\]/i.exec(stripped);
        if (!alterMatch) continue;
        const table = alterMatch[1];
        const column = alterMatch[2];
        if (!/CONSTRAINT|NOT NULL|NVARCHAR|VARCHAR|INT|DECIMAL|DATE|TIME|DATETIME|BIT|UNIQUE|CHECK|DEFAULT|REFERENCES/i.test(column)) {
          added.add(`${table}.${column}`);
        }
      }
      if (added.size === 0) continue;

      const maskedSql = sql.replace(
        /EXEC\s+sys\.sp_executesql\s+N'([\s\S]*?)'\s*;/g,
        (all, body: string) => all.slice(0, all.indexOf(body)) + body.replace(/\[[^\]]+\]/g, '[x]'),
      );
      const maskedStatements = splitStatements(maskedSql);

      for (const statement of maskedStatements) {
        if (!DML_KEYWORDS.has(leadingKeyword(statement))) continue;
        const dml = stripLeadingComments(statement);

        const targetMatch = /^(?:UPDATE|INSERT\s+INTO)\s+(?:\[[^\]]+\]\.)?\[([A-Za-z0-9_]+)\]/i.exec(dml);
        const targetTable = targetMatch?.[1];
        if (targetTable) {
          const body = dml.slice(targetMatch![0].length);
          for (const col of body.matchAll(/\[([A-Za-z0-9_]+)\]/g)) {
            if (added.has(`${targetTable}.${col[1]}`)) {
              violations.push(`${file}: DML on ${targetTable} references ${col[1]} in same batch`);
            }
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
