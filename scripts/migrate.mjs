#!/usr/bin/env node
/**
 * Migration and seed runner.
 *
 * Applies supabase/migrations/*.sql then supabase/seed/*.sql in filename order,
 * each file inside a transaction, and records what ran in a `_migrations` table
 * so re-running is safe.
 *
 *   npm run db:migrate            migrations only
 *   npm run db:migrate -- --seed  migrations then seeds
 *   npm run db:migrate -- --dry   list what would run
 *   npm run db:migrate -- --force re-run files already applied
 *
 * Needs DATABASE_URL in .env.local — the connection string from
 * Supabase → Project Settings → Database, with the password filled in.
 * Prefer the **Session pooler** string: the direct db.*.supabase.co host is
 * IPv6-only on many projects and will simply time out on a home connection.
 */

import { readFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import pg from "pg";

const args = process.argv.slice(2);
const withSeed = args.includes("--seed");
const dryRun = args.includes("--dry");
const force = args.includes("--force");

async function loadEnv() {
  try {
    const raw = await readFile(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* fall back to the ambient environment */
  }
}

async function filesIn(dir) {
  try {
    const names = (await readdir(dir))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    return names.map((n) => join(dir, n));
  } catch {
    return [];
  }
}

async function main() {
  await loadEnv();

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "\n✗ DATABASE_URL is not set in .env.local.\n\n" +
        "  Supabase dashboard → Project Settings → Database → Connection string\n" +
        "  Choose 'Session pooler', copy it, and replace [YOUR-PASSWORD] with your\n" +
        "  database password. Then add to .env.local:\n\n" +
        "    DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-...pooler.supabase.com:5432/postgres\n\n" +
        "  Do not paste that string into a chat — it contains the password.\n",
    );
    process.exit(1);
  }

  const migrations = await filesIn("supabase/migrations");
  const seeds = withSeed ? await filesIn("supabase/seed") : [];
  const planned = [...migrations, ...seeds];

  if (planned.length === 0) {
    console.error("✗ No .sql files found.");
    process.exit(1);
  }

  if (dryRun) {
    console.log("\nWould run, in order:\n");
    planned.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    console.log("");
    return;
  }

  const client = new pg.Client({
    connectionString: url,
    // Supabase terminates TLS with its own CA; verifying it from a script adds
    // nothing here and breaks on default Node trust stores.
    ssl: { rejectUnauthorized: false },
    statement_timeout: 300_000,
  });

  try {
    await client.connect();
  } catch (e) {
    console.error(`\n✗ Could not connect: ${e.message}\n`);
    if (/ENETUNREACH|ETIMEDOUT|EHOSTUNREACH/.test(e.message)) {
      console.error(
        "  That host is likely IPv6-only. Use the **Session pooler** connection\n" +
          "  string instead (aws-...pooler.supabase.com), which is reachable over IPv4.\n",
      );
    }
    if (/password authentication failed/i.test(e.message)) {
      console.error(
        "  Check the password in DATABASE_URL. If it contains @ : / ? # or %,\n" +
          "  it must be percent-encoded.\n",
      );
    }
    process.exit(1);
  }

  await client.query(`
    create table if not exists _migrations (
      filename    text primary key,
      applied_at  timestamptz not null default now()
    )
  `);

  const { rows } = await client.query("select filename from _migrations");
  const applied = new Set(rows.map((r) => r.filename));

  console.log("");
  let ran = 0;
  let skipped = 0;

  for (const file of planned) {
    const name = basename(file);

    if (applied.has(name) && !force) {
      console.log(`  – ${name.padEnd(28)} already applied`);
      skipped += 1;
      continue;
    }

    const sql = await readFile(file, "utf8");
    process.stdout.write(`  … ${name.padEnd(28)}`);

    try {
      // Each file is atomic. A seed that fails half way through would otherwise
      // leave reference data partially populated, which is far harder to spot
      // than a clean failure.
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into _migrations (filename) values ($1) on conflict (filename) do update set applied_at = now()",
        [name],
      );
      await client.query("commit");
      process.stdout.write("\r  ✓ " + name.padEnd(28) + "applied\n");
      ran += 1;
    } catch (e) {
      await client.query("rollback").catch(() => {});
      process.stdout.write("\r  ✗ " + name.padEnd(28) + "FAILED\n\n");
      console.error(`    ${e.message}`);
      if (e.position) {
        const upto = sql.slice(0, Number(e.position));
        const line = upto.split("\n").length;
        console.error(`    at line ${line} of ${name}`);
        console.error(`    ${upto.split("\n").slice(-1)[0].trim().slice(-90)}`);
      }
      console.error("\n  Nothing from this file was applied. Fix it and re-run.\n");
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log(`\n✓ ${ran} applied, ${skipped} skipped.\n`);
  if (ran > 0 && !withSeed) {
    console.log("  Next: npm run db:migrate -- --seed\n");
  }
}

main().catch((e) => {
  console.error("\n✗", e.message ?? e, "\n");
  process.exit(1);
});
