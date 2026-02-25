// Run all migrations in order
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Create migrations tracking table
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const dir = path.join(__dirname, "migrations");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();

  for (const file of files) {
    const { rows } = await client.query(
      "SELECT 1 FROM _migrations WHERE filename = $1", [file]
    );
    if (rows.length > 0) {
      console.log(`  skip: ${file} (already applied)`);
      continue;
    }
    console.log(`  applying: ${file}`);
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    await client.query(sql);
    await client.query(
      "INSERT INTO _migrations (filename) VALUES ($1)", [file]
    );
    console.log(`  done: ${file}`);
  }

  await client.end();
  console.log("Migrations complete.");
}

migrate().catch(err => { console.error(err); process.exit(1); });
