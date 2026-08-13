import { redirect } from "next/navigation";
import { appPath, isLocale, type Locale } from "@/lib/i18n";

export default async function LeaderboardIndex({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "en") as Locale;
  redirect(appPath(locale, "/leaderboard/overall"));
}
