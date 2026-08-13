import type { ModeConfig, ScoringRules } from "@/lib/config";
import type { DifficultyLabel, GameMode, Season } from "@/lib/types";

/**
 * Preview-mode fixtures.
 *
 * Active only when SPM_PREVIEW=1. Lets the whole product be walked through
 * without a database — useful for design review, and for building the
 * remaining UI before the Supabase project exists.
 *
 * The numbers here are plausible mid-season figures for one student, not
 * round marketing numbers, so the layout is stress-tested against realistic
 * digit counts.
 */

export const PREVIEW_STUDENT = {
  id: "00000000-0000-4000-8000-000000000001",
  display_name: "Aiman",
  // Admin in preview, because reviewing the product means reviewing the admin
  // panel and the switched-off modes too. Anything students cannot see is
  // marked "Admin only" in the UI, so the student view stays legible from here.
  is_admin: true,
  status: "ACTIVE" as const,
};

export const PREVIEW_SEASON: Season = {
  id: "00000000-0000-4000-8000-0000000000ff",
  code: "SPM_GAMES_2026_S1",
  name: "SPM Games 2026 — Season 1",
  starts_on: "2026-09-01",
  ends_on: "2026-10-31",
  status: "ACTIVE",
};

export const PREVIEW_SUBJECTS = [
  { code: "BM", name_en: "Bahasa Melayu", name_ms: "Bahasa Melayu" },
  { code: "ENGLISH", name_en: "English", name_ms: "Bahasa Inggeris" },
  { code: "MATH", name_en: "Mathematics", name_ms: "Matematik" },
  { code: "SCIENCE", name_en: "Science", name_ms: "Sains" },
  { code: "SEJARAH", name_en: "History", name_ms: "Sejarah" },
];

/** Mirrors supabase/seed/0002_config.sql exactly. */
export const PREVIEW_SCORING: ScoringRules = {
  daily: {
    base: 100,
    wrong: 0,
    completion_bonus: 50,
    accuracy_floor: 1.0,
    speed_bonus_weight: 0,
    difficulty_mult: { EASY: 1.0, MEDIUM: 1.25, HARD: 1.6 },
  },
  speed: {
    base: 60,
    wrong: -15,
    completion_bonus: 0,
    round_seconds: 60,
    speed_reference_ms: 12000,
    speed_bonus_weight: 1.0,
    min_response_ms: 400,
    accuracy_floor: 0.5,
    difficulty_mult: { EASY: 1.0, MEDIUM: 1.25, HARD: 1.6 },
  },
  mission: {
    base: 100,
    wrong: 0,
    completion_bonus: 200,
    accuracy_floor: 0.8,
    speed_bonus_weight: 0.25,
    speed_reference_ms: 20000,
    difficulty_mult: { EASY: 1.0, MEDIUM: 1.25, HARD: 1.6 },
  },
  boss: {
    base: 150,
    wrong: -25,
    completion_bonus: 500,
    accuracy_floor: 0.6,
    speed_bonus_weight: 0.5,
    speed_reference_ms: 15000,
    difficulty_mult: { EASY: 1.0, MEDIUM: 1.4, HARD: 2.0 },
  },
  xp: {
    correct: 100,
    wrong: 10,
    session_complete: 150,
    daily_all_subjects: 400,
    streak_day: 50,
  },
  overall_weights: { daily: 0.3, speed: 0.2, mission: 0.25, boss: 0.25 },
};

/** Sessions pin themselves to a scoring_rules row; preview needs a stable id. */
export const PREVIEW_SCORING_RULES_ID = "00000000-0000-4000-8000-0000000000aa";

/** Mirrors supabase/seed/0005_flags.sql. */
const DEFAULT_FLAGS = [
  { key: "mode.daily", label: "Daily Challenge", description: "Ten questions per subject per day.", category: "MODE" as const, enabled: true, visible_to_admin: true, sort_order: 1 },
  { key: "mode.speed", label: "Speedy Challenge", description: "Sixty-second timed rounds, unlimited.", category: "MODE" as const, enabled: true, visible_to_admin: true, sort_order: 2 },
  { key: "mode.mission", label: "Subject Missions", description: "Topic-by-topic progression. Under construction.", category: "MODE" as const, enabled: false, visible_to_admin: true, sort_order: 3 },
  { key: "mode.boss", label: "Weekly Boss Battle", description: "Weekly 20-question event. Under construction.", category: "MODE" as const, enabled: false, visible_to_admin: true, sort_order: 4 },
  { key: "competition.registration", label: "Student registration", description: "Allows new students to sign up.", category: "COMPETITION" as const, enabled: true, visible_to_admin: true, sort_order: 10 },
  { key: "competition.leaderboard", label: "Leaderboards", description: "Public ranking pages.", category: "COMPETITION" as const, enabled: true, visible_to_admin: true, sort_order: 11 },
  { key: "competition.prizes", label: "Prize showcase", description: "Prize values on the dashboard and prizes page.", category: "COMPETITION" as const, enabled: true, visible_to_admin: true, sort_order: 12 },
  { key: "competition.scoring", label: "Live scoring", description: "Master switch for recording scores.", category: "COMPETITION" as const, enabled: true, visible_to_admin: true, sort_order: 13 },
  { key: "content.explanations", label: "Answer explanations", description: "Explanation after a wrong answer.", category: "CONTENT" as const, enabled: true, visible_to_admin: true, sort_order: 20 },
  { key: "content.study_areas", label: "Study area suggestions", description: "The dashboard suggestions panel.", category: "CONTENT" as const, enabled: true, visible_to_admin: true, sort_order: 21 },
  { key: "content.behaviour_signals", label: "Behaviour insights", description: "The behaviour signals panel.", category: "CONTENT" as const, enabled: true, visible_to_admin: true, sort_order: 22 },
];

/**
 * Preview flag state.
 *
 * Held on globalThis rather than in module scope: in dev, route handlers and
 * server components are separate bundles, so a plain module-level array would
 * let the admin API and the pages disagree about which switches are on. This is
 * the standard Next.js dev-singleton pattern, and it is what makes the
 * switchboard genuinely operable without a database.
 */
type PreviewFlag = (typeof DEFAULT_FLAGS)[number];

const FLAG_STORE = Symbol.for("edupass.preview.flags");
type FlagGlobal = typeof globalThis & { [FLAG_STORE]?: PreviewFlag[] };

export function previewFlags(): PreviewFlag[] {
  const g = globalThis as FlagGlobal;
  g[FLAG_STORE] ??= DEFAULT_FLAGS.map((f) => ({ ...f }));
  return g[FLAG_STORE];
}

export function previewSetFlag(
  key: string,
  changes: { enabled?: boolean; visible_to_admin?: boolean },
) {
  const flag = previewFlags().find((f) => f.key === key);
  if (!flag) return;
  if (changes.enabled !== undefined) flag.enabled = changes.enabled;
  if (changes.visible_to_admin !== undefined) {
    flag.visible_to_admin = changes.visible_to_admin;
  }
}

export const PREVIEW_MODE_CONFIG: Record<GameMode, ModeConfig> = {
  DAILY: {
    questions_per_subject: 10,
    session_expiry_minutes: 45,
    one_run_per_day: true,
    adaptive: false,
    enabled: true,
  },
  SPEED: {
    round_seconds: 60,
    max_questions: 60,
    session_expiry_minutes: 10,
    unlimited_rounds: true,
    adaptive: true,
    enabled: true,
  },
  MISSION: { session_expiry_minutes: 60, adaptive: false, enabled: false },
  BOSS: { session_expiry_minutes: 45, adaptive: false, enabled: false },
};

/* -------------------------------------------------------------------------- */
/* Question bank                                                              */
/* -------------------------------------------------------------------------- */

export interface PreviewQuestion {
  id: string;
  subject_code: string;
  topic_name: string;
  difficulty_label: DifficultyLabel;
  stem: string;
  explanation: string;
  options: { id: string; label: string; content: string; correct: boolean }[];
}

const q = (
  id: string,
  subject_code: string,
  topic_name: string,
  difficulty_label: DifficultyLabel,
  stem: string,
  explanation: string,
  options: [string, boolean][],
): PreviewQuestion => ({
  id,
  subject_code,
  topic_name,
  difficulty_label,
  stem,
  explanation,
  options: options.map(([content, correct], i) => ({
    id: `${id}-${i}`,
    label: ["A", "B", "C", "D"][i],
    content,
    correct,
  })),
});

export const PREVIEW_QUESTIONS: PreviewQuestion[] = [
  // ---- Mathematics -------------------------------------------------------
  q("m1", "MATH", "Quadratic Functions and Equations", "EASY",
    "What are the roots of the quadratic equation x² − 5x + 6 = 0?",
    "Factorise: x² − 5x + 6 = (x − 2)(x − 3). Setting each factor to zero gives x = 2 and x = 3.",
    [["x = 2 and x = 3", true], ["x = −2 and x = −3", false], ["x = 1 and x = 6", false], ["x = 5 and x = 6", false]]),
  q("m2", "MATH", "Number Bases", "EASY",
    "Convert the binary number 1101₂ to base 10.",
    "1101₂ = 1(2³) + 1(2²) + 0(2¹) + 1(2⁰) = 8 + 4 + 0 + 1 = 13.",
    [["11", false], ["13", true], ["14", false], ["15", false]]),
  q("m3", "MATH", "Measures of Dispersion", "MEDIUM",
    "The set of data is 4, 7, 7, 9, 13. What is the interquartile range?",
    "Q1 is the median of the lower half (4, 7) = 5.5 and Q3 the median of the upper half (9, 13) = 11. IQR = 11 − 5.5 = 5.5.",
    [["4.0", false], ["5.5", true], ["6.0", false], ["9.0", false]]),
  q("m4", "MATH", "Consumer Mathematics", "EASY",
    "A shirt priced at RM80 is offered at a 15% discount. What is the selling price?",
    "Discount = 15% × RM80 = RM12. Selling price = RM80 − RM12 = RM68.",
    [["RM65", false], ["RM68", true], ["RM70", false], ["RM72", false]]),
  q("m5", "MATH", "Matrices", "MEDIUM",
    "Given matrix A = (3 1; 2 4), what is the determinant of A?",
    "For a 2×2 matrix (a b; c d), the determinant is ad − bc = (3)(4) − (1)(2) = 10.",
    [["10", true], ["14", false], ["−10", false], ["6", false]]),
  q("m6", "MATH", "Variation", "HARD",
    "If y varies inversely as the square of x, and y = 8 when x = 2, find y when x = 4.",
    "y = k/x². From y = 8, x = 2: k = 8 × 4 = 32. When x = 4, y = 32/16 = 2.",
    [["1", false], ["2", true], ["4", false], ["16", false]]),

  // ---- Science -----------------------------------------------------------
  q("s1", "SCIENCE", "Electricity and Magnetism", "EASY",
    "A resistor of 10 Ω carries a current of 2 A. What is the potential difference across it?",
    "By Ohm's law, V = IR = 2 A × 10 Ω = 20 V.",
    [["5 V", false], ["12 V", false], ["20 V", true], ["0.2 V", false]]),
  q("s2", "SCIENCE", "Heredity and Variation", "MEDIUM",
    "Which of the following best describes a gene?",
    "A gene is a segment of DNA that carries the instructions for a particular characteristic.",
    [["A structure made of protein that carries traits", false], ["A segment of DNA that codes for a characteristic", true], ["A complete set of chromosomes in a cell", false], ["A cell found only in reproductive organs", false]]),
  q("s3", "SCIENCE", "Light and Optics", "HARD",
    "An object is placed 30 cm from a converging lens of focal length 10 cm. What is the image distance?",
    "Using 1/f = 1/u + 1/v: 1/10 = 1/30 + 1/v, so 1/v = 2/30, giving v = 15 cm.",
    [["7.5 cm", false], ["15 cm", true], ["20 cm", false], ["30 cm", false]]),
  q("s4", "SCIENCE", "Motion and Force", "EASY",
    "A car accelerates uniformly from rest to 20 m/s in 5 s. What is its acceleration?",
    "a = (v − u)/t = (20 − 0)/5 = 4 m/s².",
    [["2 m/s²", false], ["4 m/s²", true], ["5 m/s²", false], ["100 m/s²", false]]),
  q("s5", "SCIENCE", "Carbon Compounds", "MEDIUM",
    "Which process converts glucose into ethanol in the absence of oxygen?",
    "Yeast converts glucose to ethanol and carbon dioxide through fermentation.",
    [["Respiration", false], ["Fermentation", true], ["Photosynthesis", false], ["Neutralisation", false]]),

  // ---- Bahasa Melayu -----------------------------------------------------
  q("b1", "BM", "Peribahasa dan Simpulan Bahasa", "EASY",
    "Apakah maksud peribahasa \"bagai aur dengan tebing\"?",
    "Peribahasa ini bermaksud hubungan yang saling bantu-membantu dan bergantung antara satu sama lain.",
    [["Hubungan yang saling bantu-membantu", true], ["Perselisihan yang berpanjangan", false], ["Perkara yang mustahil dilakukan", false], ["Seseorang yang tidak berpendirian", false]]),
  q("b2", "BM", "Tatabahasa: Kata dan Frasa", "MEDIUM",
    "Pilih ayat yang menggunakan kata sendi nama dengan betul.",
    "Kata sendi \"di\" digunakan untuk tempat, manakala \"pada\" digunakan untuk masa dan benda abstrak.",
    [["Dia tinggal pada Kuala Lumpur.", false], ["Buku itu diletakkan di atas meja.", true], ["Mereka bertemu di hari Isnin.", false], ["Surat itu dihantar di ayahnya.", false]]),
  q("b3", "BM", "Tatabahasa: Ayat", "MEDIUM",
    "Ayat manakah yang merupakan ayat pasif?",
    "Ayat pasif menekankan objek yang menerima perbuatan, biasanya menggunakan imbuhan \"di-\".",
    [["Ali membaca buku itu.", false], ["Buku itu dibaca oleh Ali.", true], ["Ali sedang membaca di perpustakaan.", false], ["Bacalah buku itu, Ali.", false]]),
  q("b4", "BM", "Komsas: Puisi dan Sajak", "EASY",
    "Dalam pantun empat kerat, apakah fungsi dua baris pertama?",
    "Dua baris pertama ialah pembayang maksud, yang membina rima sebelum maksud disampaikan.",
    [["Menyampaikan maksud sebenar", false], ["Membina pembayang maksud", true], ["Memberikan kesimpulan cerita", false], ["Menyatakan nama penulis", false]]),

  // ---- English -----------------------------------------------------------
  q("e1", "ENGLISH", "Grammar: Subject-Verb Agreement", "MEDIUM",
    "Choose the sentence with correct subject-verb agreement.",
    "With \"Neither ... nor\", the verb agrees with the subject nearest to it.",
    [["Neither the teacher nor the students was ready.", false], ["Neither the students nor the teacher was ready.", true], ["Neither the students nor the teacher were ready.", false], ["Neither the teacher or the students were ready.", false]]),
  q("e2", "ENGLISH", "Grammar: Tenses", "MEDIUM",
    "Select the correct form: \"By the time we arrived, the film ___ already.\"",
    "The past perfect is used for an action completed before another past action.",
    [["has started", false], ["started", false], ["had started", true], ["was starting", false]]),
  q("e3", "ENGLISH", "Idioms and Phrasal Verbs", "EASY",
    "What does the idiom \"to bite the bullet\" mean?",
    "It means to force yourself to endure something painful but unavoidable.",
    [["To speak without thinking", false], ["To endure something painful but unavoidable", true], ["To act with unnecessary aggression", false], ["To make a costly mistake", false]]),
  q("e4", "ENGLISH", "Reading Comprehension", "HARD",
    "A writer states: \"The proposal, though ambitious, rests on assumptions few would accept.\" What is the writer's attitude?",
    "The concession followed by a criticism of its assumptions signals scepticism, not hostility or support.",
    [["Enthusiastic support", false], ["Complete indifference", false], ["Reasoned scepticism", true], ["Open hostility", false]]),

  // ---- Sejarah -----------------------------------------------------------
  q("j1", "SEJARAH", "Kemerdekaan Negara", "EASY",
    "Pada tarikh manakah Persekutuan Tanah Melayu mencapai kemerdekaan?",
    "Kemerdekaan diisytiharkan pada 31 Ogos 1957 oleh Tunku Abdul Rahman di Stadium Merdeka.",
    [["31 Ogos 1957", true], ["16 September 1963", false], ["31 Ogos 1963", false], ["1 Februari 1948", false]]),
  q("j2", "SEJARAH", "Pembentukan Malaysia", "EASY",
    "Negeri manakah menyertai Malaysia pada 1963 tetapi keluar pada 1965?",
    "Singapura menyertai Malaysia pada 16 September 1963 dan berpisah pada 9 Ogos 1965.",
    [["Sarawak", false], ["Sabah", false], ["Singapura", true], ["Brunei", false]]),
  q("j3", "SEJARAH", "Malayan Union dan Persekutuan Tanah Melayu", "HARD",
    "Apakah sebab utama penentangan orang Melayu terhadap Malayan Union?",
    "Penentangan berpunca daripada pengurangan kuasa Raja-Raja Melayu dan kerakyatan jus soli.",
    [["Cukai yang terlalu tinggi", false], ["Kuasa Raja-Raja Melayu dikurangkan dan kerakyatan jus soli diperkenalkan", true], ["Bahasa Inggeris dijadikan bahasa rasmi tunggal", false], ["Tanah Melayu digabungkan dengan Indonesia", false]]),
  q("j4", "SEJARAH", "Warisan Kesultanan Melayu Melaka", "MEDIUM",
    "Siapakah pengasas Kesultanan Melayu Melaka?",
    "Parameswara mengasaskan Melaka sekitar tahun 1400 selepas berundur dari Palembang dan Temasik.",
    [["Sultan Mansur Shah", false], ["Parameswara", true], ["Tun Perak", false], ["Sultan Muzaffar Shah", false]]),
];

/* -------------------------------------------------------------------------- */
/* Progress                                                                    */
/* -------------------------------------------------------------------------- */

export const PREVIEW_SUBJECT_STATS = [
  { code: "MATH", name: "Mathematics", attempts: 214, mastery: 0.84, points: 4820 },
  { code: "ENGLISH", name: "English", attempts: 168, mastery: 0.81, points: 3640 },
  { code: "SCIENCE", name: "Science", attempts: 191, mastery: 0.78, points: 4110 },
  { code: "BM", name: "Bahasa Melayu", attempts: 152, mastery: 0.72, points: 2980 },
  { code: "SEJARAH", name: "History", attempts: 137, mastery: 0.68, points: 2410 },
];

export const PREVIEW_SIGNALS = [
  { signal: "FAST_THINKER", value: 0.82, confidence: 0.91 },
  { signal: "MATHEMATICAL_STRONG", value: 0.84, confidence: 0.88 },
  { signal: "PRESSURE_PERFORMER", value: 0.76, confidence: 0.72 },
  { signal: "DIFFICULTY_TOLERANT", value: 0.69, confidence: 0.64 },
];

const NAMES = [
  "Nurul Izzah", "Wei Jie", "Harvind", "Siti Aisyah", "Danial Hakim",
  "Chong Mei Ling", "Tengku Ariff", "Priya Devi", "Faris Iqbal", "Lee Zhi Hao",
  "Amirah Sofea", "Kavitha", "Zulhilmi", "Tan Yee Ling", "Muhammad Haziq",
  "Nur Alia", "Ravi Chandran", "Ong Kai Wen", "Syafiqah", "Adam Rayyan",
];

const SCHOOLS = [
  ["SMK Taman Melawati", "W.P. Kuala Lumpur"],
  ["SMK Seri Bintang Utara", "W.P. Kuala Lumpur"],
  ["SMJK Chung Hwa", "Pulau Pinang"],
  ["SMK Bandar Utama Damansara", "Selangor"],
  ["SMK Sultan Abdul Halim", "Kedah"],
  ["SMKA Kuala Lumpur", "W.P. Kuala Lumpur"],
  ["SMK Batu Lintang", "Sarawak"],
  ["SMK Likas", "Sabah"],
  ["SMK Dato Bentara Luar", "Johor"],
  ["SMK Sri Permata", "Terengganu"],
];

/** Deterministic — the same board every reload, so screenshots are stable. */
export function previewBoardRows(seed: number) {
  return NAMES.map((name, i) => {
    const [school, state] = SCHOOLS[i % SCHOOLS.length];
    return {
      rank: i + 1,
      student_id: `p-${seed}-${i}`,
      display_name: name,
      school_name: school,
      state_name: state,
      points: Math.round(18400 - i * 640 - ((i * seed) % 190)),
      is_you: false,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Prizes                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors supabase/seed/0004_prizes.sql. Placeholder values — structurally
 * correct so the layout can be judged, but not commitments.
 *
 * image_url is null throughout on purpose: this is what the section looks like
 * before any photography exists, which is the state it will be in for most of
 * the build.
 */
const prize = (
  rank: number,
  title: string,
  subtitle: string | null,
  value_myr: number,
) => ({
  rank,
  title,
  subtitle,
  value_myr,
  image_url: null,
  image_alt: null,
  sponsor_name: null,
});

export const PREVIEW_PRIZES = [
  {
    code: "OVERALL_CHAMPION",
    name: "EduPass Overall Champion",
    description: "Highest weighted score across all game modes.",
    category: "OVERALL",
    subject_code: null,
    prizes: [
      prize(1, 'MacBook Air M3 13"', "Plus RM3,000 EduPass scholarship credit", 7500),
      prize(2, "iPad Air + Apple Pencil", "Plus RM1,500 EduPass credit", 4200),
      prize(3, "Samsung Galaxy Tab S9", "Plus RM800 EduPass credit", 2600),
    ],
  },
  {
    code: "DAILY_CHAMPION",
    name: "Daily Challenge Champion",
    description: "Highest accumulated Daily Challenge score.",
    category: "DAILY",
    subject_code: null,
    prizes: [
      prize(1, "RM2,000 cash", "Plus a one-year EduPass Pro account", 2000),
      prize(2, "RM1,200 cash", null, 1200),
      prize(3, "RM600 cash", null, 600),
    ],
  },
  {
    code: "SPEED_CHAMPION",
    name: "Speedy Challenge Champion",
    description: "Highest accumulated Speedy Challenge score.",
    category: "SPEED",
    subject_code: null,
    prizes: [
      prize(1, "RM2,000 cash", "Plus a gaming headset", 2000),
      prize(2, "RM1,200 cash", null, 1200),
      prize(3, "RM600 cash", null, 600),
    ],
  },
  {
    code: "SCHOOL_CHAMPION",
    name: "School Champion",
    description: "Highest mean score among qualifying schools.",
    category: "SCHOOL",
    subject_code: null,
    prizes: [
      prize(1, "RM5,000 for the school", "Plus a trophy and an EduPass workshop", 5000),
      prize(2, "RM3,000 for the school", null, 3000),
      prize(3, "RM1,500 for the school", null, 1500),
    ],
  },
  {
    code: "CONSISTENCY_CHAMPION",
    name: "Consistency Champion",
    description: "Most consistent participation across the season.",
    category: "CONSISTENCY",
    subject_code: null,
    prizes: [
      prize(1, "RM1,500 cash", "For showing up, every single week", 1500),
      prize(2, "RM900 cash", null, 900),
      prize(3, "RM500 cash", null, 500),
    ],
  },
  {
    code: "MOST_IMPROVED",
    name: "Most Improved",
    description: "Largest genuine improvement between September and October.",
    category: "IMPROVED",
    subject_code: null,
    prizes: [
      prize(1, "RM1,500 cash", "Plus a full SPM revision bundle", 1500),
      prize(2, "RM900 cash", null, 900),
      prize(3, "RM500 cash", null, 500),
    ],
  },
  ...PREVIEW_SUBJECTS.map((s) => ({
    code: `SUBJECT_CHAMPION_${s.code}`,
    name: `${s.name_en} Champion`,
    description: `Highest ${s.name_en} score for the season.`,
    category: "SUBJECT",
    subject_code: s.code,
    prizes: [
      prize(1, "RM1,000 cash", "Plus a subject revision bundle", 1000),
      prize(2, "RM600 cash", null, 600),
      prize(3, "RM300 cash", null, 300),
    ],
  })),
];

export const PREVIEW_TREND = Array.from({ length: 21 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 8, 10 + i));
  // A believable upward drift with real week-to-week wobble, rather than a
  // suspiciously smooth line.
  const wobble = [0, 4, -3, 6, -2, 3, -5, 8, 1, -4, 5, 2, -1, 7, -3, 4, 0, 6, -2, 3, 5][i];
  return {
    date: date.toISOString().slice(0, 10),
    attempts: 18 + ((i * 7) % 23),
    accuracy: Math.min(0.95, 0.58 + i * 0.011 + wobble / 100),
    avg_response_ms: 9200 - i * 90 + wobble * 60,
  };
});
