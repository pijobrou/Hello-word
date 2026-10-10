export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export const htmlLang: Record<Locale, string> = { fr: "fr-CA", en: "en-CA" };
export const ogLocale: Record<Locale, string> = { fr: "fr_CA", en: "en_CA" };

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function otherLocale(locale: Locale): Locale {
  return locale === "fr" ? "en" : "fr";
}

/**
 * Pages du site. Les dossiers de `src/app/[locale]` portent le segment anglais ;
 * les segments français sont servis par réécriture (voir next.config.ts).
 */
export const routes = {
  home: { fr: "", en: "" },
  about: { fr: "a-propos", en: "about" },
  solutions: { fr: "solutions", en: "solutions" },
  technologies: { fr: "technologies", en: "technologies" },
  sectors: { fr: "secteurs", en: "sectors" },
  innovations: { fr: "innovations", en: "innovations" },
  method: { fr: "methode", en: "method" },
  insights: { fr: "perspectives", en: "insights" },
  contact: { fr: "contact", en: "contact" },
  privacy: { fr: "confidentialite", en: "privacy" },
  brand: { fr: "identite", en: "brand" },
} as const satisfies Record<string, Record<Locale, string>>;

export type RouteKey = keyof typeof routes;

/** Segments français qui diffèrent du dossier (anglais) correspondant. */
export const localizedSegments = (Object.values(routes) as Array<Record<Locale, string>>).filter(
  (r) => r.fr !== r.en,
);

export function href(locale: Locale, route: RouteKey, ...rest: string[]): string {
  const parts = [locale, routes[route][locale], ...rest].filter(Boolean);
  return `/${parts.join("/")}`;
}
