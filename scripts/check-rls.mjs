#!/usr/bin/env node
/**
 * Security check.
 *
 * Uses the ANON key — the one that ships to every browser — and tries to read
 * and write the things a student must never touch. Each line is a claim the
 * architecture makes, tested against the real database rather than asserted.
 *
 *   npm run db:security
 */

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

async function loadEnv() {
  const raw = await readFile(".env.local", "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

let failures = 0;
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  failures += 1;
  console.log(`  ✗ ${m}`);
};

async function main() {
  await loadEnv();
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );

  console.log("\nReading as an anonymous browser client\n");

  // --- Must be invisible ---------------------------------------------------
  const secrets = [
    ["question_options", "answer keys — the whole game depends on these"],
    ["questions", "question bank, scrapeable before a Daily Challenge opens"],
    ["student_profiles", "phone numbers, emails, postcodes"],
    ["scoring_rules", "the scoring formula"],
    ["feature_flags", "the switchboard"],
    ["daily_challenge_questions", "tomorrow's question set"],
  ];

  for (const [table, why] of secrets) {
    const { data, error } = await anon.from(table).select("*").limit(1);
    const blocked = error != null || (data ?? []).length === 0;
    blocked
      ? pass(`${table.padEnd(26)} hidden  (${why})`)
      : fail(`${table.padEnd(26)} READABLE — ${why}`);
  }

  // --- Must be visible -----------------------------------------------------
  console.log("");
  const publics = [["subjects", 5], ["states", 16], ["seasons", 1]];
  for (const [table, min] of publics) {
    const { data, error } = await anon.from(table).select("*");
    const n = (data ?? []).length;
    !error && n >= min
      ? pass(`${table.padEnd(26)} readable (${n} rows) — needed by the UI`)
      : fail(`${table.padEnd(26)} should be readable, got ${n} rows ${error?.message ?? ""}`);
  }

  // --- Must be unwritable --------------------------------------------------
  console.log("\nWriting as an anonymous browser client\n");

  const w1 = await anon
    .from("feature_flags")
    .update({ enabled: true })
    .eq("key", "mode.boss")
    .select();
  (w1.error || (w1.data ?? []).length === 0)
    ? pass("feature_flags             cannot be flipped")
    : fail("feature_flags             WRITEABLE — anyone could switch modes on");

  const w2 = await anon.from("question_attempts").insert({
    session_question_id: "00000000-0000-4000-8000-000000000001",
    session_id: "00000000-0000-4000-8000-000000000001",
    student_id: "00000000-0000-4000-8000-000000000001",
    question_id: "00000000-0000-4000-8000-000000000001",
    subject_id: "00000000-0000-4000-8000-000000000001",
    season_id: "00000000-0000-4000-8000-000000000001",
    mode: "SPEED",
    is_correct: true,
    response_time_ms: 1,
    difficulty_at_attempt: 50,
    difficulty_label_at_attempt: "EASY",
    points_awarded: 999999,
    xp_awarded: 999999,
  });
  w2.error
    ? pass("question_attempts         cannot be inserted (score = 999999 refused)")
    : fail("question_attempts         INSERTED — scores can be fabricated");

  const w3 = await anon
    .from("student_season_stats")
    .update({ overall_points: 999999 })
    .neq("student_id", "00000000-0000-4000-8000-000000000000")
    .select();
  (w3.error || (w3.data ?? []).length === 0)
    ? pass("student_season_stats      cannot be updated")
    : fail("student_season_stats      WRITEABLE — leaderboard can be forged");

  const w4 = await anon.from("questions").insert({
    code: "HACK-0001",
    subject_id: "00000000-0000-4000-8000-000000000001",
    stem: "x",
    source_type: "EDUPASS",
  });
  w4.error
    ? pass("questions                 cannot be inserted")
    : fail("questions                 INSERTED — bank can be poisoned");

  console.log(
    failures === 0
      ? "\n✓ All security claims hold against the live database.\n"
      : `\n✗ ${failures} security check(s) FAILED. Do not launch until these are fixed.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\n✗", e.message ?? e, "\n");
  process.exit(1);
});
