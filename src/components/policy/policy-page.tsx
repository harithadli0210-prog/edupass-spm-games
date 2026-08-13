import Link from "next/link";
import { FileText, Mail, ShieldCheck } from "lucide-react";
import type { PolicyDoc } from "@/content/policy.en";

/**
 * Renders a rules or privacy document.
 *
 * Long-form legal text on a phone is where readers give up, so the layout does
 * the work the prose cannot: a narrow measure, numbered headings that survive
 * being linked to, and lists broken out rather than buried in paragraphs.
 *
 * Section headings carry ids so a support reply can point at "rule 3" directly.
 */
export function PolicyPage({
  doc,
  effectiveFrom,
  kind,
  contactLabel,
}: {
  doc: PolicyDoc;
  effectiveFrom: string;
  kind: "rules" | "privacy";
  contactLabel: string;
}) {
  const Icon = kind === "rules" ? FileText : ShieldCheck;

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-7 pb-4">
      <header>
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold text-ink">
          <Icon size={24} strokeWidth={2.2} className="shrink-0 text-brand-500" />
          {doc.title}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-body">{doc.intro}</p>
        <p className="mt-3 text-xs text-muted">
          {doc.updated} {effectiveFrom}
        </p>
      </header>

      {doc.sections.map((section) => {
        const id = section.heading
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        return (
          <section key={section.heading} id={id} className="scroll-mt-24">
            <h2 className="font-display text-base font-bold text-ink">
              <a href={`#${id}`} className="hover:text-brand-500">
                {section.heading}
              </a>
            </h2>

            {section.body.map((p) => (
              <p key={p} className="mt-2 text-[15px] leading-relaxed text-body">
                {p}
              </p>
            ))}

            {section.list && (
              <ul className="mt-3 flex flex-col gap-2">
                {section.list.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[15px] leading-relaxed text-body">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-300" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <div className="flex items-center gap-3 rounded-md border border-line bg-white p-4">
        <Mail size={20} strokeWidth={2} className="shrink-0 text-brand-500" />
        <p className="text-sm text-muted">
          {contactLabel}{" "}
          <Link
            href="mailto:spmgames@edupass.my"
            className="font-semibold text-brand-500"
          >
            spmgames@edupass.my
          </Link>
        </p>
      </div>
    </article>
  );
}
