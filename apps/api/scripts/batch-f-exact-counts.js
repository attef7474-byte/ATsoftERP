const msnodesqlv8 = require('msnodesqlv8');
const CONN_STR = 'Driver={ODBC Driver 17 for SQL Server};Server=localhost,50079;Database=ATsoftERP_DB;Trusted_Connection=yes;';

function q(sql) {
  return new Promise((resolve, reject) => {
    msnodesqlv8.query(CONN_STR, sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function main() {
  console.log('=== EXACT PRE-IMPORT DB SNAPSHOT ===');
  console.log('');
  
  const tables = [
    'companies', 'branches', 'administrations', 'departments',
    'job_titles', 'operational_people', 'operational_person_assignments',
    'supervisor_assignments', 'maintenance_personnel',
    'machine_responsibility_assignments', 'organizational_units',
    'machines', 'production_lines'
  ];
  
  for (const tbl of tables) {
    const rows = await q(`SELECT COUNT(*) AS cnt FROM ${tbl}`);
    console.log(`${tbl} = ${rows[0].cnt}`);
  }
  
  console.log('');
  console.log('=== EXACT PRE-IMPORT SNAPSHOT PASS ===');
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
