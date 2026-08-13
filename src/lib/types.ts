/**
 * Domain types shared between server engines, API routes and UI.
 * These mirror the Postgres schema in supabase/migrations/.
 */

/* -------------------------------------------------------------------------- */
/* Enumerations — kept as string unions matching the DB check constraints      */
/* -------------------------------------------------------------------------- */

export const GAME_MODES = ["DAILY", "SPEED", "MISSION", "BOSS"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const DIFFICULTY_LABELS = ["EASY", "MEDIUM", "HARD"] as const;
export type DifficultyLabel = (typeof DIFFICULTY_LABELS)[number];

export const DIFFICULTY_SOURCES = ["ADMIN", "BLENDED", "COMPUTED"] as const;
export type DifficultySource = (typeof DIFFICULTY_SOURCES)[number];

export const QUESTION_TYPES = [
  "MCQ",
  "TRUE_FALSE",
  // Reserved. The schema stores type as text with a jsonb payload column, so
  // these are additive later with no migration to the questions table.
  "MATCHING",
  "ORDERING",
  "CLOZE",
  "IMAGE",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const SOURCE_TYPES = [
  "SPM_PAST_YEAR",
  "TRIAL_PAPER",
  "TOPICAL",
  "TEACHER_CREATED",
  "EDUPASS",
  "AI_GENERATED",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SESSION_STATUSES = [
  "ACTIVE",
  "COMPLETED",
  "EXPIRED",
  "ABANDONED",
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const LEADERBOARDS = [
  "overall",
  "daily",
  "speed",
  "subject",
  "school",
  "consistency",
  "improved",
] as const;
export type LeaderboardKey = (typeof LEADERBOARDS)[number];

export const BEHAVIOUR_SIGNALS = [
  "FAST_THINKER",
  "CAREFUL_RESPONDER",
  "ANALYTICAL",
  "LANGUAGE_STRONG",
  "SCIENCE_STRONG",
  "MATHEMATICAL_STRONG",
  "PERSISTENT",
  "CONSISTENT",
  "PRESSURE_PERFORMER",
  "DIFFICULTY_TOLERANT",
] as const;
export type BehaviourSignal = (typeof BEHAVIOUR_SIGNALS)[number];

/* -------------------------------------------------------------------------- */
/* Reference                                                                   */
/* -------------------------------------------------------------------------- */

export interface Season {
  id: string;
  code: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: "UPCOMING" | "ACTIVE" | "ENDED";
}

export interface Subject {
  id: string;
  code: string;
  name_en: string;
  name_ms: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

export interface StateRow {
  id: string;
  code: string;
  name: string;
}

export interface District {
  id: string;
  state_id: string;
  name: string;
}

export interface School {
  id: string;
  name: string;
  normalized_name: string;
  state_id: string | null;
  district_id: string | null;
  moe_code: string | null;
  status: "VERIFIED" | "PENDING_REVIEW" | "MERGED";
  merged_into_id: string | null;
}

/* -------------------------------------------------------------------------- */
/* Gameplay — the client-facing shapes                                        */
/* -------------------------------------------------------------------------- */

/**
 * A question as the browser is allowed to see it.
 *
 * Note what is absent: no `is_correct` on any option, no correct answer id, no
 * explanation. Those exist only in the answer response, after the student has
 * committed. This type is the contract that keeps it that way.
 */
export interface ServedQuestion {
  question_id: string;
  position: number;
  question_type: QuestionType;
  stem: string;
  stem_media: Record<string, unknown> | null;
  options: ServedOption[];
  subject_code: string;
  topic_name: string | null;
  difficulty_label: DifficultyLabel;
  /** Wall-clock deadline for this question, if the mode enforces one. */
  expires_at: string | null;
}

export interface ServedOption {
  option_id: string;
  label: string;
  content: string;
}

export interface AnswerResult {
  is_correct: boolean;
  correct_option_id: string;
  explanation: string | null;
  points_awarded: number;
  xp_awarded: number;
  speed_bonus: number;
  response_time_ms: number;
  running_points: number;
  running_correct: number;
  running_answered: number;
  /** Null when the mode has no fixed length (Speedy runs until time). */
  questions_remaining: number | null;
}

export interface SessionSummary {
  session_id: string;
  mode: GameMode;
  subject_code: string;
  answered: number;
  correct: number;
  accuracy: number;
  raw_points: number;
  accuracy_factor: number;
  final_points: number;
  completion_bonus: number;
  xp_awarded: number;
  avg_response_ms: number;
  level_before: number;
  level_after: number;
}

/* -------------------------------------------------------------------------- */
/* Progression & leaderboards                                                  */
/* -------------------------------------------------------------------------- */

export interface SeasonStats {
  daily_points: number;
  speed_points: number;
  mission_points: number;
  boss_points: number;
  overall_points: number;
  xp: number;
  level: number;
  active_days: number;
  current_streak: number;
  longest_streak: number;
  questions_answered: number;
  questions_correct: number;
}

export interface SubjectStats {
  subject_id: string;
  subject_code: string;
  attempts: number;
  correct: number;
  accuracy: number;
  avg_response_ms: number;
  mastery: number;
}

export interface LeaderboardRow {
  rank: number;
  student_id: string;
  display_name: string;
  school_name: string | null;
  state_name: string | null;
  points: number;
  /** True for the row belonging to the requesting student. */
  is_you?: boolean;
}

export interface LeaderboardResponse {
  board: LeaderboardKey;
  scope: string;
  top: LeaderboardRow[];
  /** A window of rows centred on the caller, when they are outside the top. */
  around_you: LeaderboardRow[];
  you: LeaderboardRow | null;
  total_participants: number;
  /** Points needed to reach the Top 100 cutoff. Null once already inside. */
  points_to_top_100: number | null;
}
