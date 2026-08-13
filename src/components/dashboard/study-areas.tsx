import { Compass } from "lucide-react";
import { SectionHeading } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import type { Dictionary, Locale } from "@/lib/i18n";

/**
 * Potential study areas (spec §28).
 *
 * The language here is load-bearing and was written to a constraint: this is an
 * invitation to explore, never a claim about a student's future. So the heading
 * is "You might enjoy exploring", the qualifier "based on your current game
 * behaviour" sits directly beneath it, and nothing says "you should become".
 *
 * A wrong nudge delivered confidently to a 17-year-old choosing a course is a
 * real harm, and the mapping behind this is a handful of accuracy figures from
 * a quiz game — nowhere near enough to justify certainty.
 */
interface Cluster {
  key: string;
  when: (ctx: Ctx) => boolean;
  areas: string[];
}

interface Ctx {
  mastery: Record<string, number>;
  attempts: Record<string, number>;
  signals: Set<string>;
}

const CLUSTERS: Cluster[] = [
  {
    key: "technology",
    when: (c) => c.mastery.MATH >= 0.7 && c.signals.has("ANALYTICAL"),
    areas: ["Computer Science", "Engineering", "Data Science", "Technology"],
  },
  {
    key: "engineering",
    when: (c) => c.mastery.MATH >= 0.7 && c.mastery.SCIENCE >= 0.65,
    areas: ["Engineering", "Physics", "Architecture", "Actuarial Science"],
  },
  {
    key: "health",
    when: (c) => c.mastery.SCIENCE >= 0.75,
    areas: ["Medicine", "Pharmacy", "Biomedical Science", "Health Sciences"],
  },
  {
    key: "communication",
    when: (c) =>
      (c.mastery.ENGLISH ?? 0) >= 0.7 && (c.mastery.BM ?? 0) >= 0.65,
    areas: ["Law", "Communication", "Business", "Education"],
  },
  {
    key: "humanities",
    when: (c) => (c.mastery.SEJARAH ?? 0) >= 0.7,
    areas: ["Law", "Political Science", "International Relations", "Education"],
  },
  {
    key: "business",
    when: (c) => c.mastery.MATH >= 0.6 && (c.mastery.ENGLISH ?? 0) >= 0.6,
    areas: ["Business", "Accounting", "Economics", "Finance"],
  },
];

/** Enough evidence before suggesting anything at all. */
const MIN_ATTEMPTS_PER_SUBJECT = 20;
const MIN_TOTAL_ATTEMPTS = 60;

export function StudyAreas({
  signals,
  subjects,
  dict,
  lang,
}: {
  signals: { signal: string; value: number }[];
  subjects: { code: string; mastery: number; attempts: number }[];
  dict: Dictionary;
  lang: Locale;
}) {
  const mastery: Record<string, number> = {};
  const attempts: Record<string, number> = {};
  for (const subject of subjects) {
    // A subject with four attempts tells us nothing; excluding it is better
    // than letting a fluke drive a recommendation.
    if (subject.attempts >= MIN_ATTEMPTS_PER_SUBJECT) {
      mastery[subject.code] = subject.mastery;
    }
    attempts[subject.code] = subject.attempts;
  }

  const total = subjects.reduce((sum, s) => sum + s.attempts, 0);
  const ctx: Ctx = {
    mastery,
    attempts,
    signals: new Set(signals.map((s) => s.signal)),
  };

  const matched =
    total >= MIN_TOTAL_ATTEMPTS
      ? CLUSTERS.filter((cluster) => cluster.when(ctx))
      : [];

  const areas = [...new Set(matched.flatMap((c) => c.areas))].slice(0, 4);

  return (
    <section>
      <SectionHeading title={dict.studyAreas.title} />

      {areas.length === 0 ? (
        <EmptyState
          icon={<Compass size={24} strokeWidth={2} />}
          title={dict.studyAreas.emptyTitle}
          description={dict.studyAreas.emptyBody}
        />
      ) : (
        <div className="rounded-lg border border-line bg-white p-5">
          <ul className="flex flex-wrap gap-2">
            {areas.map((area) => (
              <li
                key={area}
                className="rounded-full bg-brand-100 px-3.5 py-2 font-display text-sm font-semibold text-brand-700"
              >
                {area}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs leading-relaxed text-muted">
            {dict.studyAreas.disclaimer}
          </p>

          <a
            href={`https://edupass.my/${lang}/`}
            className="mt-3 inline-block font-display text-sm font-semibold text-brand-500 hover:text-brand-600"
          >
            {dict.studyAreas.cta}
          </a>
        </div>
      )}
    </section>
  );
}
