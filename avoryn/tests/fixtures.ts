import { routes, type Locale, type RouteKey } from "../src/lib/i18n";
import { sectorKeys, sectorSlugs } from "../src/lib/slugs";

export const LOCALES: Locale[] = ["fr", "en"];

const PAGE_KEYS: RouteKey[] = Object.keys(routes) as RouteKey[];

/** Toutes les pages publiques, par langue (pages + fiches secteur). */
export function allPaths(locale: Locale): string[] {
  const pages = PAGE_KEYS.map((key) => `/${[locale, routes[key][locale]].filter(Boolean).join("/")}`);
  const sectors = sectorKeys.map((key) => `/${locale}/${routes.sectors[locale]}/${sectorSlugs[key][locale]}`);
  return [...pages, ...sectors];
}

export const ALL_PATHS = LOCALES.flatMap(allPaths);

