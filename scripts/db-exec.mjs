// One-off SQL runner (no psql available locally).
// Usage: SUPABASE_DB_URL="postgresql://...:<encoded-pw>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" \
//   node scripts/db-exec.mjs supabase/migrations/028_notifications.sql
import { readFileSync } from 'node:fs'
import pg from 'pg'

const file = process.argv[2]
if (!file) { console.error('usage: node scripts/db-exec.mjs <file.sql>'); process.exit(1) }
const url = process.env.SUPABASE_DB_URL
if (!url) { console.error('set SUPABASE_DB_URL'); process.exit(1) }

const sql = readFileSync(file, 'utf8')
const c = new pg.Client({ connectionString: url })
await c.connect()
await c.query(sql)
console.log('applied:', file)
await c.end()
