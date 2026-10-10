import type { Metadata } from "next";
import { getDictionary } from "@/content";
import { href, htmlLang, locales, ogLocale, otherLocale, type Locale, type RouteKey } from "./i18n";
import { site } from "./site";

export function absoluteUrl(path: string): string {
  return `${site.url}${path}`;
}

type PageMeta = {
  locale: Locale;
  route: RouteKey;
  title: string;
  description: string;
  /** Segments supplémentaires par langue (ex. slug de secteur). */
  rest?: Record<Locale, string[]>;
  /** Titre complet, sans le suffixe « | AVORYN ». */
  absoluteTitle?: boolean;
  noindex?: boolean;
  type?: "website" | "article";
};

export function localizedPaths(route: RouteKey, rest?: Record<Locale, string[]>): Record<Locale, string> {
  return Object.fromEntries(locales.map((l) => [l, href(l, route, ...(rest?.[l] ?? []))])) as Record<Locale, string>;
}

export function buildMetadata({
  locale,
  route,
  title,
  description,
  rest,
  absoluteTitle,
  noindex,
  type = "website",
}: PageMeta): Metadata {
  const paths = localizedPaths(route, rest);
  const dict = getDictionary(locale);
  const fullTitle = absoluteTitle ? title : `${title} | ${dict.meta.siteName}`;
  const indexable = site.allowIndexing && !noindex;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: absoluteUrl(paths[locale]),
      languages: {
        [htmlLang.fr]: absoluteUrl(paths.fr),
        [htmlLang.en]: absoluteUrl(paths.en),
        "x-default": absoluteUrl(paths.fr),
      },
    },
    openGraph: {
      type,
      siteName: dict.meta.siteName,
      title: fullTitle,
      description,
      url: absoluteUrl(paths[locale]),
      locale: ogLocale[locale],
      alternateLocale: [ogLocale[otherLocale(locale)]],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
  };
}
