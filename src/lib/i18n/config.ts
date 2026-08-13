/**
 * Locales, matched to the live site.
 *
 * edupass.my serves /en/ and /ms/ with the same path structure underneath, so
 * the game mounts at /{lang}/spm-games-2026/* and slots straight in behind a
 * Cloudflare route. No basePath, no rewriting of internal links.
 */

export const LOCALES = ["en", "ms"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** The path segment the game lives under, on both the site and here. */
export const APP_SEGMENT = "spm-games-2026";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Build an in-app URL.
 *
 * Every internal link goes through this. Hard-coding "/en/..." anywhere is how
 * a bilingual site ends up dumping a Malay reader back into English halfway
 * through a journey.
 */
export function appPath(lang: Locale, path = ""): string {
  const suffix = path && !path.startsWith("/") ? `/${path}` : path;
  return `/${lang}/${APP_SEGMENT}${suffix}`;
}

/** Pulls the locale out of a pathname, for client components. */
export function localeFromPath(pathname: string): Locale {
  const segment = pathname.split("/").filter(Boolean)[0];
  return segment && isLocale(segment) ? segment : DEFAULT_LOCALE;
}

/** Same page, other language — for the switcher. */
export function switchLocalePath(pathname: string, to: Locale): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length > 0 && isLocale(parts[0])) {
    parts[0] = to;
    return `/${parts.join("/")}`;
  }
  return appPath(to);
}

export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  ms: "Bahasa Melayu",
};

/** Short label for the switcher chip, mirroring the live site's "BM". */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  ms: "BM",
};

/** For Intl formatting and the html lang attribute. */
export const LOCALE_TAG: Record<Locale, string> = {
  en: "en-MY",
  ms: "ms-MY",
};
