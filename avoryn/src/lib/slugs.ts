import { routes, type Locale } from "./i18n";

/** Identifiants stables des secteurs et leurs segments d'URL par langue. */
export const sectorSlugs = {
  professional: { fr: "services-professionnels", en: "professional-services" },
  accounting: { fr: "comptabilite-administration", en: "accounting-administration" },
  hr: { fr: "ressources-humaines-recrutement", en: "human-resources-recruitment" },
  realEstate: { fr: "immobilier", en: "real-estate" },
  ecommerce: { fr: "commerce-electronique", en: "e-commerce" },
  publicProcurement: { fr: "marches-publics", en: "public-procurement" },
} as const satisfies Record<string, Record<Locale, string>>;

export type SectorKey = keyof typeof sectorSlugs;
export const sectorKeys = Object.keys(sectorSlugs) as SectorKey[];

export function isSectorKey(value: string): value is SectorKey {
  return (sectorKeys as string[]).includes(value);
}

export function sectorFromSlug(locale: Locale, slug: string): SectorKey | undefined {
  return sectorKeys.find((key) => sectorSlugs[key][locale] === slug);
}

/** Segments d'articles (Perspectives) par identifiant. */
export const articleSlugs = {
  processFirst: { fr: "commencer-par-le-processus", en: "start-with-the-process" },
  aiGuardrails: { fr: "ia-appliquee-encadrement", en: "applied-ai-guardrails" },
  decisionDashboards: { fr: "tableaux-de-bord-utiles", en: "dashboards-that-matter" },
} as const satisfies Record<string, Record<Locale, string>>;

export type ArticleKey = keyof typeof articleSlugs;

const segmentTables: Array<Record<Locale, string>> = [
  ...Object.values(routes),
  ...Object.values(sectorSlugs),
  ...Object.values(articleSlugs),
];

/** Traduit un chemin (/fr/secteurs/immobilier) vers l'autre langue (/en/sectors/real-estate). */
export function translatePath(pathname: string, target: Locale): string {
  const [, ...rest] = pathname.split("/").filter(Boolean);
  const from: Locale = target === "fr" ? "en" : "fr";
  const translated = rest.map((segment) => {
    const match = segmentTables.find((entry) => entry[from] === segment);
    return match ? match[target] : segment;
  });
  return `/${[target, ...translated].join("/")}`;
}
