import { PolicyPage } from "@/components/policy/policy-page";
import { getPolicyDoc } from "@/lib/queries/policy";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const { doc } = await getPolicyDoc("privacy", (isLocale(lang) ? lang : "en") as Locale);
  return { title: doc.title };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "en") as Locale;
  const dict = getDictionary(locale);
  const { doc, effectiveFrom } = await getPolicyDoc("privacy", locale);

  return (
    <PolicyPage
      doc={doc}
      effectiveFrom={effectiveFrom}
      kind="privacy"
      contactLabel={dict.policy.contact}
    />
  );
}
