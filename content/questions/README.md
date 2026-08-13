# Question bank

Drop question files in this folder. One file per batch — usually one subject and
one source per file. `npm run questions:import` validates and loads them.

```
content/questions/
  _TEMPLATE.json          copy this to start
  math-spm-2023.json
  science-topical-f4.json
  bm-trial-selangor-2024.json
```

---

## How to give me questions

You don't have to write JSON. Send whatever you have and I'll convert it:

| What you send | What I do |
|---|---|
| A PDF or photo of a past-year paper | Transcribe into a batch file, tag topic + difficulty |
| A Word/Excel list of questions | Convert and fill in the metadata |
| "Generate 40 Form 4 Algebra questions" | Author them as `AI_GENERATED`, flagged for your review |
| A textbook chapter | Draft questions from it, marked `EDUPASS` |

What I **cannot** do is decide whether you have the rights to republish a
commercial source. That is the `rights_cleared` field, and it is yours to set.

---

## File format

```jsonc
{
  "subject": "MATH",            // BM | ENGLISH | MATH | SCIENCE | SEJARAH
  "source": {
    "type": "SPM_PAST_YEAR",    // see Source types below
    "name": "SPM 2023 Paper 1", // free text, shown in admin only
    "year": 2023,               // optional
    "state": null,              // optional, for trial papers: "SGR", "JHR", ...
    "rights_cleared": false     // YOU set this. See Rights below.
  },
  "questions": [ ... ]
}
```

### One question

```jsonc
{
  "code": "MATH-00101",         // unique, permanent. Re-importing updates it.
  "topic": "Quadratic Functions and Equations",  // must match a seeded topic
  "form": 4,                    // 4 or 5
  "type": "MCQ",                // MCQ | TRUE_FALSE
  "difficulty": 35,             // 0-100, YOUR estimate. See Difficulty below.
  "stem": "What are the roots of x² − 7x + 12 = 0?",
  "options": [
    { "content": "x = 3 and x = 4", "correct": true },
    { "content": "x = −3 and x = −4", "correct": false },
    { "content": "x = 2 and x = 6", "correct": false },
    { "content": "x = 1 and x = 12", "correct": false }
  ],
  "explanation": "Factorise: (x − 3)(x − 4). Setting each factor to zero gives x = 3 and x = 4."
}
```

**Rules the importer enforces:**

- `code` unique across the whole bank, and stable — it is how a re-import
  updates rather than duplicates.
- Exactly one option with `"correct": true`.
- MCQ needs 3–5 options; TRUE_FALSE needs exactly 2.
- `topic` must already exist for that subject (seeded in `0001_reference.sql`).
  A typo fails the import rather than silently creating a topic.
- `explanation` is required. It is the only teaching moment the format has, and
  it is shown after every wrong answer.

---

## Difficulty

`difficulty` is 0–100 and maps to EASY (0–33) / MEDIUM (34–66) / HARD (67–100).

Set it as honestly as you can, but don't agonise. It is a **starting estimate
only**. Once a question has been answered ~50 times the difficulty engine begins
blending in its own measurement, and by ~200 attempts your number is fully
replaced by the measured one.

Rough guide:

| Score | Means |
|---|---|
| 10–25 | Most students get it right; recall or one step |
| 30–45 | Standard exam question, two steps |
| 50–65 | Needs a method chosen correctly |
| 70–85 | Multi-step, easy to slip |
| 90+ | Top-band discriminator |

---

## Source types

| Type | Use for |
|---|---|
| `SPM_PAST_YEAR` | Actual SPM papers |
| `TRIAL_PAPER` | State or school trial papers |
| `TOPICAL` | Topical revision books |
| `TEACHER_CREATED` | Written by a teacher for us |
| `EDUPASS` | Written in-house |
| `AI_GENERATED` | Generated, needs human review before going live |

Trial papers must **never** be labelled `SPM_PAST_YEAR`. The distinction is
stored per question and surfaces in admin.

---

## Rights

`rights_cleared` defaults to `false`. Questions import fine either way, but
anything with `rights_cleared: false` is a flag for you, not a blocker for the
build.

Before the campaign goes public, confirm you have permission for anything from a
commercial source. I can't assess that — set the field once you know.

---

## Importing

```bash
# Validate without writing anything
npm run questions:check

# Validate and load
npm run questions:import

# One file only
npm run questions:import -- content/questions/math-spm-2023.json

# Load as DRAFT instead of ACTIVE (won't be served to students)
npm run questions:import -- --draft
```

The importer is idempotent: running it twice updates by `code` rather than
creating duplicates.

Needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

---

## How many do we need?

| Mode | Minimum | Comfortable |
|---|---|---|
| Daily Challenge | 10/subject/day × 61 days ÷ reuse | 300+ per subject |
| Speedy Challenge | shares the same pool | — |
| **Launch floor** | **25 per subject (125 total)** | **150+ per subject** |

At 25 per subject the Daily Challenge repeats questions within a fortnight, and
the difficulty engine never reaches a stable sample on anything. It works, but
it is thin. 150+ per subject is where the system behaves as designed.
