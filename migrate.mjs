import { readFileSync } from 'fs'
import pg from 'pg'

const client = new pg.Client({
  host: process.env.PGHOST || 'db.ynfkwndtmoajcmjppftp.supabase.co',
  port: 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
})

async function run() {
  await client.connect()
  console.log('✓ connected')
  for (const f of [
    'supabase/migrations/024_admin_report_triage.sql',
    'supabase/migrations/025_admin_metrics.sql',
  ]) {
    await client.query(readFileSync(f, 'utf8'))
    console.log('✓ applied', f)
  }
  // sanity: confirm new objects exist (admin grant handled separately)
  const cols = await client.query(`select column_name from information_schema.columns
    where table_name='reports' and column_name='status'`)
  const fn = await client.query(`select proname from pg_proc where proname in ('is_admin','admin_metrics')`)
  console.log('✓ reports.status exists:', cols.rowCount === 1)
  console.log('✓ functions present:', fn.rows.map(r => r.proname).join(', '))
  await client.end()
}

run().catch(e => { console.error('✗ ERROR:', e.message); process.exit(1) })
