#!/usr/bin/env node
/**
 * Question bank importer.
 *
 * Validates every file completely before writing anything. A batch that fails
 * validation writes nothing at all — a half-imported paper is worse than none,
 * because the gap is invisible until a student hits it mid-round.
 *
 *   npm run questions:check                     validate only
 *   npm run questions:import                    validate and load
 *   npm run questions:import -- path/to.json    one file
 *   npm run questions:import -- --draft         load as DRAFT, not ACTIVE
 */

import { readFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DIR = "content/questions";

const SUBJECTS = ["BM", "ENGLISH", "MATH", "SCIENCE", "SEJARAH", "PENDIDIKAN_ISLAM", "PENDIDIKAN_MORAL"];
const SOURCE_TYPES = ["SPM_PAST_YEAR", "TRIAL_PAPER", "TOPICAL", "TEACHER_CREATED", "EDUPASS", "AI_GENERATED"];
const TYPES = ["MCQ", "TRUE_FALSE"];

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const asDraft = args.includes("--draft");
const files = args.filter((a) => !a.startsWith("--"));

/* -------------------------------------------------------------------------- */
/* Env                                                                        */
/* -------------------------------------------------------------------------- */

async function loadEnv() {
  try {
    const raw = await readFile(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
    }
  } catch {
    /* no .env.local — rely on the ambient environment */
  }
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

function validateBatch(file, batch, seenCodes) {
  const errors = [];
  const at = (msg) => errors.push(`${basename(file)}: ${msg}`);

  if (!SUBJECTS.includes(batch.subject)) {
    at(`subject "${batch.subject}" is not one of ${SUBJECTS.join(", ")}`);
  }

  const source = batch.source ?? {};
  if (!SOURCE_TYPES.includes(source.type)) {
    at(`source.type "${source.type}" is not one of ${SOURCE_TYPES.join(", ")}`);
  }
  if (!Array.isArray(batch.questions) || batch.questions.length === 0) {
    at("questions is empty");
    return errors;
  }

  batch.questions.forEach((q, i) => {
    const where = `question ${i + 1} (${q.code ?? "no code"})`;

    if (!q.code || !/^[A-Z0-9-]{3,32}$/.test(q.code)) {
      at(`${where}: code must be uppercase letters, digits and hyphens`);
    } else if (seenCodes.has(q.code)) {
      at(`${where}: duplicate code, already used in ${seenCodes.get(q.code)}`);
    } else {
      seenCodes.set(q.code, basename(file));
    }

    if (!q.stem || q.stem.trim().length < 8) at(`${where}: stem is missing or too short`);
    if (!q.explanation || q.explanation.trim().length < 8) {
      at(`${where}: explanation is required — it is shown after every wrong answer`);
    }
    if (!TYPES.includes(q.type)) at(`${where}: type must be MCQ or TRUE_FALSE`);
    if (typeof q.difficulty !== "number" || q.difficulty < 0 || q.difficulty > 100) {
      at(`${where}: difficulty must be a number 0-100`);
    }
    if (q.form != null && ![1, 2, 3, 4, 5].includes(q.form)) {
      at(`${where}: form must be 1-5`);
    }

    const options = q.options ?? [];
    const correct = options.filter((o) => o.correct === true);
    if (correct.length !== 1) {
      at(`${where}: needs exactly one correct option, found ${correct.length}`);
    }
    if (q.type === "TRUE_FALSE" && options.length !== 2) {
      at(`${where}: TRUE_FALSE needs exactly 2 options`);
    }
    if (q.type === "MCQ" && (options.length < 3 || options.length > 5)) {
      at(`${where}: MCQ needs 3-5 options, found ${options.length}`);
    }
    options.forEach((o, oi) => {
      if (!o.content || !String(o.content).trim()) {
        at(`${where}: option ${oi + 1} has no content`);
      }
    });
  });

  return errors;
}

function label(score) {
  return score <= 33 ? "EASY" : score <= 66 ? "MEDIUM" : "HARD";
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  await loadEnv();

  const targets = files.length
    ? files
    : (await readdir(DIR))
        .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
        .map((f) => join(DIR, f));

  if (targets.length === 0) {
    console.log(`No question files in ${DIR}/. Copy _TEMPLATE.json to start.`);
    return;
  }

  // ---- Parse + validate everything first ---------------------------------
  const batches = [];
  const allErrors = [];
  const seenCodes = new Map();

  for (const file of targets) {
    let batch;
    try {
      batch = JSON.parse(await readFile(file, "utf8"));
    } catch (e) {
      allErrors.push(`${basename(file)}: invalid JSON — ${e.message}`);
      continue;
    }
    allErrors.push(...validateBatch(file, batch, seenCodes));
    batches.push({ file, batch });
  }

  const total = batches.reduce((n, b) => n + (b.batch.questions?.length ?? 0), 0);

  if (allErrors.length > 0) {
    console.error(`\n✗ ${allErrors.length} problem(s) found. Nothing was imported.\n`);
    allErrors.slice(0, 40).forEach((e) => console.error(`  ${e}`));
    if (allErrors.length > 40) console.error(`  ... and ${allErrors.length - 40} more`);
    process.exit(1);
  }

  console.log(`✓ ${total} questions across ${batches.length} file(s) are valid.`);

  if (checkOnly) {
    console.log("Check only — nothing written.");
    return;
  }

  // ---- Write --------------------------------------------------------------
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes("placeholder")) {
    console.error(
      "\n✗ Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY in .env.local, or run with --check to validate only.",
    );
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  const [{ data: subjects }, { data: topics }, { data: states }] = await Promise.all([
    db.from("subjects").select("id, code"),
    db.from("topics").select("id, name, subject_id"),
    db.from("states").select("id, code"),
  ]);

  const subjectByCode = new Map((subjects ?? []).map((s) => [s.code, s.id]));
  const stateByCode = new Map((states ?? []).map((s) => [s.code, s.id]));
  const topicKey = (subjectId, name) => `${subjectId}::${name.trim().toLowerCase()}`;
  const topicByKey = new Map(
    (topics ?? []).map((t) => [topicKey(t.subject_id, t.name), t.id]),
  );

  let inserted = 0;
  let optionCount = 0;

  for (const { file, batch } of batches) {
    const subjectId = subjectByCode.get(batch.subject);
    if (!subjectId) {
      console.error(`✗ ${basename(file)}: subject ${batch.subject} not found in the database`);
      process.exit(1);
    }

    // Resolve topics up front so an unknown topic fails before any write.
    const unknownTopics = new Set();
    for (const q of batch.questions) {
      if (q.topic && !topicByKey.has(topicKey(subjectId, q.topic))) {
        unknownTopics.add(q.topic);
      }
    }
    if (unknownTopics.size > 0) {
      console.error(
        `✗ ${basename(file)}: unknown topic(s) for ${batch.subject}:\n` +
          [...unknownTopics].map((t) => `    "${t}"`).join("\n") +
          `\n  Topics must already exist. Check spelling against supabase/seed/0001_reference.sql.`,
      );
      process.exit(1);
    }

    const rows = batch.questions.map((q) => ({
      code: q.code,
      subject_id: subjectId,
      topic_id: q.topic ? topicByKey.get(topicKey(subjectId, q.topic)) : null,
      form: q.form ?? null,
      question_type: q.type,
      stem: q.stem.trim(),
      explanation: q.explanation.trim(),
      difficulty_score: Math.round(q.difficulty),
      difficulty_label: label(q.difficulty),
      difficulty_source: "ADMIN",
      source_type: batch.source.type,
      source_name: batch.source.name ?? null,
      source_year: batch.source.year ?? null,
      source_state_id: batch.source.state ? (stateByCode.get(batch.source.state) ?? null) : null,
      rights_cleared: Boolean(batch.source.rights_cleared),
      status: asDraft ? "DRAFT" : "ACTIVE",
    }));

    const { data: saved, error } = await db
      .from("questions")
      .upsert(rows, { onConflict: "code" })
      .select("id, code");

    if (error) {
      console.error(`✗ ${basename(file)}: ${error.message}`);
      process.exit(1);
    }

    const idByCode = new Map((saved ?? []).map((r) => [r.code, r.id]));

    // Replace options wholesale rather than diffing: a re-import is the fix for
    // a wrong answer key, and a partial update could leave two correct options.
    const ids = [...idByCode.values()];
    await db.from("question_options").delete().in("question_id", ids);

    const optionRows = batch.questions.flatMap((q) =>
      (q.options ?? []).map((o, i) => ({
        question_id: idByCode.get(q.code),
        label: String.fromCharCode(65 + i),
        content: String(o.content).trim(),
        is_correct: o.correct === true,
        sort_order: i + 1,
      })),
    );

    const { error: optError } = await db.from("question_options").insert(optionRows);
    if (optError) {
      console.error(`✗ ${basename(file)}: options — ${optError.message}`);
      process.exit(1);
    }

    inserted += rows.length;
    optionCount += optionRows.length;
    console.log(
      `  ${basename(file)} → ${rows.length} questions (${batch.subject}, ${batch.source.type})`,
    );
  }

  console.log(
    `\n✓ Imported ${inserted} questions and ${optionCount} options as ${asDraft ? "DRAFT" : "ACTIVE"}.`,
  );

  const { count } = await db
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "ACTIVE");
  console.log(`  Bank now holds ${count ?? "?"} active questions.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
