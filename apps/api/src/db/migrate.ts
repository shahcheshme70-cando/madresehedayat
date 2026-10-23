import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { Pool } from 'pg';
import { config } from '../config';
import { encryptExisting } from './encrypt-existing';

/** هنگام بالا آمدن کانتینر اجرا می‌شود: همهٔ مهاجرت‌های پوشهٔ drizzle را اعمال می‌کند. */
async function main() {
  const pool = new Pool({ connectionString: config.databaseUrl });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle') });
  await encryptExisting(db);
  await pool.end();
  console.log('مهاجرت پایگاه داده انجام شد');
}
main().catch((e) => { console.error(e); process.exit(1); });
