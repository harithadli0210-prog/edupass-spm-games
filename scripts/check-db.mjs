#!/usr/bin/env node
/**
 * Connection and seed check.
 *
 * Verifies that .env.local points at a real project, that the migrations ran,
 * and that the seeds landed — without ever printing a key. Secrets are reported
 * only as present/absent and by length, so this is safe to run and safe to
 * paste the output of.
 *
 *   npm run db:check
 */

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

async function loadEnv() {
  try {
    const raw = await readFile(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    console.error("✗ No .env.local found. Copy .env.example and fill it in.");
    process.exit(1);
  }
}

const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => console.log(`  ✗ ${m}`);
const warn = (m) => console.log(`  ! ${m}`);

async function main() {
  await loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const preview = process.env.SPM_PREVIEW === "1";

  console.log("\nEnvironment");
  if (!url || url.includes("placeholder")) {
    bad("NEXT_PUBLIC_SUPABASE_URL is missing or still a placeholder");
    process.exit(1);
  }
  // Host only — safe to show, and it is how you confirm the right project.
  ok(`URL      ${new URL(url).host}`);
  anon && !anon.includes("placeholder")
    ? ok(`anon key set (${anon.length} chars)`)
    : bad("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or a placeholder");
  service && !service.includes("placeholder")
    ? ok(`service key set (${service.length} chars)`)
    : bad("SUPABASE_SERVICE_ROLE_KEY is missing or a placeholder");

  if (!service || service.includes("placeholder")) process.exit(1);

  if (preview) {
    warn(
      "SPM_PREVIEW=1 — the app will ignore this database and serve fixtures.\n" +
        "    Remove that line once the seeds are in, or you will be reviewing fake data.",
    );
  }

  const db = createClient(url, service, { auth: { persistSession: false } });

  console.log("\nSchema");
  const tables = [
    "seasons",
    "subjects",
    "topics",
    "states",
    "districts",
    "questions",
    "question_options",
    "feature_flags",
    "scoring_rules",
    "level_thresholds",
    "award_prizes",
    "daily_challenges",
  ];

  const counts = {};
  let missing = 0;

  for (const table of tables) {
    // NOT head:true. PostgREST answers a HEAD request with 204 and no error
    // even when the table does not exist, so a head-only probe reports every
    // table as present and the check becomes worthless. A real select returns
    // a 404 with "Could not find the table" instead.
    const { count, error } = await db
      .from(table)
      .select("*", { count: "exact" })
      .limit(1);

    if (error) {
      const detail = /schema cache|does not exist/i.test(error.message)
        ? "missing"
        : error.message;
      bad(`${table.padEnd(20)} ${detail}`);
      missing += 1;
    } else {
      counts[table] = count ?? 0;
      ok(`${table.padEnd(20)} ${count} rows`);
    }
  }

  if (missing > 0) {
    console.log(
      `\n✗ ${missing} table(s) unreachable. Run the migrations in supabase/migrations/ in order.\n`,
    );
    process.exit(1);
  }

  console.log("\nSeed state");
  const { data: season } = await db
    .from("seasons")
    .select("code, starts_on, ends_on, status")
    .eq("status", "ACTIVE")
    .maybeSingle();

  season
    ? ok(`Active season: ${season.code} (${season.starts_on} → ${season.ends_on})`)
    : bad("No ACTIVE season — run supabase/seed/0001_reference.sql");

  counts.subjects >= 5
    ? ok(`${counts.subjects} subjects`)
    : bad("Subjects not seeded");

  counts.feature_flags > 0
    ? ok(`${counts.feature_flags} feature flags`)
    : bad("Feature flags not seeded — run supabase/seed/0005_flags.sql");

  // The question bank is the launch blocker, so it gets a real verdict.
  const { count: activeQ } = await db
    .from("questions")
    .select("*", { count: "exact" })
    .eq("status", "ACTIVE")
    .limit(1);

  console.log("\nQuestion bank");
  if (!activeQ) bad("No active questions");
  else if (activeQ < 125)
    warn(`${activeQ} active questions — below the 125 launch floor`);
  else if (activeQ < 750)
    warn(`${activeQ} active questions — works, but thin (750 is comfortable)`);
  else ok(`${activeQ} active questions`);

  // Daily Challenges must be OPEN for today or nobody can play.
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const { count: openToday } = await db
    .from("daily_challenges")
    .select("*", { count: "exact" })
    .eq("challenge_date", today)
    .eq("status", "OPEN")
    .limit(1);

  console.log("\nToday");
  openToday
    ? ok(`${openToday} Daily Challenge(s) OPEN for ${today}`)
    : warn(
        `No Daily Challenge OPEN for ${today}. Run: select open_daily_challenges();\n` +
          "    (and schedule it with pg_cron — see DEPLOY.md)",
      );

  const { count: admins } = await db
    .from("students")
    .select("*", { count: "exact" })
    .eq("is_admin", true)
    .limit(1);

  console.log("\nAdmin");
  admins
    ? ok(`${admins} admin account(s)`)
    : warn(
        "No admin yet. Sign in once, then:\n" +
          "    update students set is_admin = true where id = '<your-auth-user-id>';",
      );

  console.log("");
}

main().catch((e) => {
  console.error("\n✗", e.message ?? e, "\n");
  process.exit(1);
});
