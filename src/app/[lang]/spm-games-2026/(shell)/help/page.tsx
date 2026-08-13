import Link from "next/link";
import { LifeBuoy, Mail } from "lucide-react";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return { title: getDictionary((isLocale(lang) ? lang : "en") as Locale).help.title };
}

export default async function HelpPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dict = getDictionary((isLocale(lang) ? lang : "en") as Locale);
  const email = "spmgames@edupass.my";
  const [before, after] = dict.help.stillStuck.split("{email}");

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink">
          <LifeBuoy size={22} strokeWidth={2.2} className="text-brand-500" />
          {dict.help.title}
        </h1>
        <p className="mt-1 text-sm text-muted">{dict.help.sub}</p>
      </div>

      <div className="flex flex-col gap-3">
        {dict.help.faqs.map((faq) => (
          <details
            key={faq.q}
            className="group rounded-md border border-line bg-white p-4 [&_summary::-webkit-details-marker]:hidden"
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

      <div className="flex items-center gap-3 rounded-md border border-line bg-white p-4">
        <Mail size={20} strokeWidth={2} className="shrink-0 text-brand-500" />
        <p className="text-sm text-muted">
          {before}
          <Link href={`mailto:${email}`} className="font-semibold text-brand-500">
            {email}
          </Link>
          {after}
        </p>
      </div>
    </div>
  );
}
