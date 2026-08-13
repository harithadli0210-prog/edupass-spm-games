import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * School identity resolution (spec §16).
 *
 * The School Champion leaderboard is only as good as school identity, and
 * students type free text. "SMK ABC", "SMK A.B.C" and "smk abc " must not
 * become three schools.
 *
 * This mirrors normalize_school_name() in 0001_schema.sql. It is duplicated
 * deliberately: the SQL version keeps the stored column correct even for rows
 * written outside the app (imports, admin edits), while this version lets
 * onboarding show a match to the student before anything is written.
 */
/** Combining diacritical marks, written as escapes so the source stays ASCII. */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizeSchoolName(raw: string): string {
  let s = raw
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toUpperCase()
    .trim();

  s = s.replace(/&/g, " AND ");
  s = s.replace(/[^A-Z0-9 ]/g, " "); // punctuation → space
  s = s.replace(/\s+/g, " ").trim();

  // Expand the long forms students write out, so they collapse onto the
  // abbreviation the MOE registry uses.
  const expansions: [RegExp, string][] = [
    [/^SEKOLAH MENENGAH KEBANGSAAN AGAMA\b/, "SMKA"],
    [/^SEKOLAH MENENGAH JENIS KEBANGSAAN\b/, "SMJK"],
    [/^SEKOLAH MENENGAH KEBANGSAAN\b/, "SMK"],
    [/^SEKOLAH MENENGAH TEKNIK\b/, "SMT"],
    [/^SEKOLAH BERASRAMA PENUH\b/, "SBP"],
    [/^SEK MEN JEN KEB\b/, "SMJK"],
    [/^SEK MEN KEB\b/, "SMK"],
    [/^SEK MEN\b/, "SMK"],
  ];
  for (const [pattern, replacement] of expansions) {
    s = s.replace(pattern, replacement);
  }

  return s.replace(/\s+/g, " ").trim();
}

export interface SchoolMatch {
  school_id: string;
  name: string;
  similarity: number;
  method: "EXACT" | "TRIGRAM" | "CREATED";
  /** True when the match is close but not certain — ask the student. */
  needs_confirmation: boolean;
}

const AUTO_LINK_THRESHOLD = 0.85;
const SUGGEST_THRESHOLD = 0.6;

/**
 * Resolve a typed school name to a school row.
 *
 * Three stages, in order:
 *   1. Exact match on the normalised name within the student's state.
 *   2. Trigram similarity. Above 0.85 links automatically; 0.60–0.85 is
 *      returned for the student to confirm.
 *   3. No match creates a PENDING_REVIEW school. It works immediately — a
 *      student is never blocked from playing by an unrecognised school — and
 *      surfaces in the admin merge queue.
 *
 * Merging later rewrites merged_into_id, and the leaderboard resolves through
 * it, so historical rows never need backfilling.
 */
export async function resolveSchool(args: {
  rawName: string;
  stateId: string | null;
  districtId: string | null;
}): Promise<SchoolMatch> {
  const db = supabaseAdmin();
  const normalized = normalizeSchoolName(args.rawName);

  // ---- 1. Exact -----------------------------------------------------------
  const exact = await db
    .from("schools")
    .select("id, name")
    .eq("normalized_name", normalized)
    .neq("status", "MERGED")
    .eq("state_id", args.stateId ?? "")
    .maybeSingle();

  if (exact.data) {
    await recordAlias(normalized, args.rawName, exact.data.id, "EXACT", 1);
    return {
      school_id: exact.data.id,
      name: exact.data.name,
      similarity: 1,
      method: "EXACT",
      needs_confirmation: false,
    };
  }

  // ---- 2. Trigram ---------------------------------------------------------
  const { data: fuzzy } = await db.rpc("match_school", {
    p_normalized: normalized,
    p_state_id: args.stateId,
    p_threshold: SUGGEST_THRESHOLD,
  });

  const best = (fuzzy ?? [])[0] as
    | { id: string; name: string; similarity: number }
    | undefined;

  if (best && best.similarity >= AUTO_LINK_THRESHOLD) {
    await recordAlias(normalized, args.rawName, best.id, "TRIGRAM", best.similarity);
    return {
      school_id: best.id,
      name: best.name,
      similarity: best.similarity,
      method: "TRIGRAM",
      needs_confirmation: false,
    };
  }

  if (best && best.similarity >= SUGGEST_THRESHOLD) {
    return {
      school_id: best.id,
      name: best.name,
      similarity: best.similarity,
      method: "TRIGRAM",
      needs_confirmation: true,
    };
  }

  // ---- 3. Create pending --------------------------------------------------
  const { data: created, error } = await db
    .from("schools")
    .insert({
      name: args.rawName.trim(),
      normalized_name: normalized,
      state_id: args.stateId,
      district_id: args.districtId,
      status: "PENDING_REVIEW",
    })
    .select("id, name")
    .single();

  if (error) throw error;

  await recordAlias(normalized, args.rawName, created.id, "CREATED", 1);
  return {
    school_id: created.id,
    name: created.name,
    similarity: 1,
    method: "CREATED",
    needs_confirmation: false,
  };
}

async function recordAlias(
  normalized: string,
  raw: string,
  schoolId: string,
  method: SchoolMatch["method"] | "MANUAL",
  similarity: number,
) {
  await supabaseAdmin()
    .from("school_aliases")
    .insert({
      raw_name: raw.trim(),
      normalized_name: normalized,
      school_id: schoolId,
      match_method: method,
      similarity,
    });
}
