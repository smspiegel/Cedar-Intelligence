import { readdir, readFile } from "node:fs/promises";
import { loadConfig } from "../src/config.js";
import { connectSurreal } from "../src/adapters/surreal-connection.js";
const c = loadConfig();
const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
if (!identifier.test(c.SURREAL_NAMESPACE) || !identifier.test(c.SURREAL_DATABASE)) throw new Error("Namespace and database names must be simple SurrealQL identifiers");
const db = await connectSurreal(c, false);
await db.query(`DEFINE NAMESPACE IF NOT EXISTS ${c.SURREAL_NAMESPACE}; USE NS ${c.SURREAL_NAMESPACE}; DEFINE DATABASE IF NOT EXISTS ${c.SURREAL_DATABASE};`);
await db.use({ namespace: c.SURREAL_NAMESPACE, database: c.SURREAL_DATABASE });
await db.query("DEFINE TABLE IF NOT EXISTS schema_migration SCHEMALESS; DEFINE INDEX IF NOT EXISTS schema_migration_name ON TABLE schema_migration FIELDS name UNIQUE;");
const [applied] = await db.query<[Array<{ name: string }>]>("SELECT name FROM schema_migration");
const completed = new Set(applied.map(row => row.name));
const migrationDir = new URL("../migrations/", import.meta.url);
const names = (await readdir(migrationDir)).filter(name => name.endsWith(".surql")).sort();
for (const name of names) {
  if (completed.has(name)) continue;
  await db.query(await readFile(new URL(name, migrationDir), "utf8"));
  await db.query("CREATE schema_migration CONTENT $data", { data: { name, appliedAt: new Date().toISOString() } });
  console.log(`Applied migrations/${name}`);
}
await db.close();
