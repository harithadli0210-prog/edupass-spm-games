import Link from "next/link";
import { LifeBuoy, Mail } from "lucide-react";

export const metadata = { title: "Help Center" };

const FAQS: { q: string; a: string }[] = [
  {
    q: "How is my score calculated?",
    a: "Every correct answer earns base points, multiplied by how hard the question is. In Speedy Challenge, faster answers earn a bonus on top. At the end of a round your total is scaled by your accuracy, so answering carefully is worth more than answering quickly.",
  },
  {
    q: "Why did my Speedy score drop after answering more questions?",
    a: "Wrong answers cost points, and your round total is multiplied by an accuracy factor. Answering 100 questions badly will not beat answering 20 well — that is deliberate, so the leaderboard rewards understanding rather than tapping.",
  },
  {
    q: "Can I play the Daily Challenge more than once?",
    a: "Once per subject per day, and everyone in Malaysia gets the same ten questions, so the Daily leaderboard is a fair comparison. Speedy Challenge has no daily limit.",
  },
  {
    q: "How are Daily and Speedy scores combined?",
    a: "They are not — each has its own leaderboard and its own prizes. Your Overall rank combines them using a published weighting, after normalising each mode so neither one dominates just because it produces bigger numbers.",
  },
  {
    q: "What counts for the Consistency award?",
    a: "Active days, how many Daily Challenges you complete, and your longest streak. Total hours played is deliberately excluded — it rewards showing up regularly, not grinding.",
  },
  {
    q: "Who can see my details?",
    a: "Leaderboards show only your display name, school and state. Your phone number, email and postcode are never shown publicly and are not readable by other students.",
  },
];

export default function HelpPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink">
          <LifeBuoy size={22} strokeWidth={2.2} className="text-brand-500" />
          Help Center
        </h1>
        <p className="mt-1 text-sm text-muted">
          How scoring, ranking and prizes work.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {FAQS.map((faq) => (
          <details
            key={faq.q}
            className="group rounded-lg border border-line bg-white p-4 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-sm font-semibold text-ink">
              {faq.q}
              <span
                aria-hidden
                className="shrink-0 text-lg leading-none text-brand-500 transition-transform duration-200 group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{faq.a}</p>
          </details>
        ))}
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-line bg-white p-4">
        <Mail size={20} strokeWidth={2} className="shrink-0 text-brand-500" />
        <p className="text-sm text-muted">
          Still stuck? Email{" "}
          <Link href="mailto:spmgames@edupass.my" className="font-semibold text-brand-500">
            spmgames@edupass.my
          </Link>{" "}
          and we&apos;ll get back to you.
        </p>
      </div>
    </div>
  );
}
