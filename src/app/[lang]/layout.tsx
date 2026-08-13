import type { Metadata, Viewport } from "next";
import { Poppins, Nunito_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { getDictionary, isLocale, LOCALE_TAG, LOCALES } from "@/lib/i18n";

/**
 * Root layout, scoped to the locale segment.
 *
 * This is the app's ONLY root layout — there is no src/app/layout.tsx. That is
 * deliberate: `<html lang>` has to reflect the actual language of the page, and
 * a layout above the [lang] segment cannot see which language that is. Putting
 * the root here is the supported Next pattern for i18n, and it means a Malay
 * page is announced as Malay to screen readers and to search engines.
 *
 * `/` is redirected to the default locale in proxy.ts, so nothing needs to
 * render outside this segment.
 */

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const nunito = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(isLocale(lang) ? lang : "en");
  return {
    title: { default: dict.meta.title, template: dict.meta.titleTemplate },
    description: dict.meta.description,
  };
}

export const viewport: Viewport = {
  // The logo purple. Tints browser chrome on Android and the status bar in a
  // saved-to-homescreen install.
  themeColor: "#6846d6",
  width: "device-width",
  initialScale: 1,
  // Students zoom to read questions on small screens; never lock that away.
  maximumScale: 5,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html lang={LOCALE_TAG[lang]}>
      <body className={`${poppins.variable} ${nunito.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
