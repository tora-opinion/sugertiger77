import { translations, type Locale, type TranslationKey } from "./translations";

export type { Locale };

export function getLang(astroLocale: string | undefined): Locale {
  return astroLocale === "ja" ? "ja" : "en";
}

export function t(
  key: TranslationKey,
  lang: Locale,
  vars?: Record<string, string>,
): string {
  let str: string = translations[key][lang];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, v);
    }
  }
  return str;
}

export function getLocalizedPath(
  currentPath: string,
  targetLang: Locale,
): string {
  const cleanPath =
    currentPath.replace(/^\/ja\/?/, "/").replace(/\/$/, "") || "/";
  if (targetLang === "ja") {
    return `/ja${cleanPath === "/" ? "/" : cleanPath}`;
  }
  return cleanPath || "/";
}
