/**
 * Very small "migration" runner:
 * - Reads .sql files from src/migrations and executes them in lexical order.
 *
 * For real-world apps consider a dedicated migration tool, but this meets the
 * requirement while remaining simple and easy to understand.
 */

require("dotenv").config();

const fs = require("node:fs/promises");
const path = require("node:path");
const { pool } = require("./db");

async function main() {
  const migrationsDir = path.join(__dirname, "migrations");
  const files = (await fs.readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migrations found.");
    return;
  }

  console.log(`Running ${files.length} migration(s)...`);

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = await fs.readFile(fullPath, "utf8");
    if (!sql.trim()) continue;
    console.log(`- Executing ${file}`);
    await pool.query(sql);
  }

  console.log("Migrations completed successfully.");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Always close pool so process can exit
    await pool.end().catch(() => undefined);
  });

