import type { MetadataRoute } from "next";
import { visibleArticles } from "@/content/insights";
import { htmlLang, locales, type Locale, type RouteKey } from "@/lib/i18n";
import { absoluteUrl, localizedPaths } from "@/lib/seo";
import { articleSlugs, sectorKeys, sectorSlugs } from "@/lib/slugs";

const PAGES: RouteKey[] = [
  "home",
  "about",
  "solutions",
  "technologies",
  "sectors",
  "innovations",
  "method",
  "insights",
  "contact",
  "privacy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: Array<{ route: RouteKey; rest?: Record<Locale, string[]> }> = [
    ...PAGES.map((route) => ({ route })),
    ...sectorKeys.map((key) => ({
      route: "sectors" as const,
      rest: { fr: [sectorSlugs[key].fr], en: [sectorSlugs[key].en] },
    })),
    // Les brouillons ne figurent jamais dans le plan du site.
    ...visibleArticles()
      .filter((a) => a.status === "published")
      .map((a) => ({
        route: "insights" as const,
        rest: { fr: [articleSlugs[a.key].fr], en: [articleSlugs[a.key].en] },
      })),
  ];

  return entries.flatMap(({ route, rest }) => {
    const paths = localizedPaths(route, rest);
    const languages = {
      [htmlLang.fr]: absoluteUrl(paths.fr),
      [htmlLang.en]: absoluteUrl(paths.en),
      "x-default": absoluteUrl(paths.fr),
    };
    return locales.map((locale) => ({
      url: absoluteUrl(paths[locale]),
      alternates: { languages },
      changeFrequency: "monthly" as const,
      priority: route === "home" ? 1 : rest ? 0.6 : 0.8,
    }));
  });
}
