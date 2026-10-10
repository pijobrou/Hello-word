/**
 * Configuration administrable du site.
 * Aucune coordonnée n'est inventée : tant qu'une valeur est absente,
 * l'élément correspondant n'est pas affiché.
 */

function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export const site = {
  name: "AVORYN",
  url: (optional(process.env.NEXT_PUBLIC_SITE_URL) ?? "http://localhost:3000").replace(/\/$/, ""),
  /** Le site peut être indexé uniquement si NEXT_PUBLIC_ALLOW_INDEXING=true. */
  allowIndexing: process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true",
  /** Affiche les articles en brouillon (développement et révision seulement). */
  showDrafts: process.env.NEXT_PUBLIC_SHOW_DRAFTS === "true",
  contact: {
    email: optional(process.env.NEXT_PUBLIC_CONTACT_EMAIL),
    phone: optional(process.env.NEXT_PUBLIC_CONTACT_PHONE),
    city: optional(process.env.NEXT_PUBLIC_CONTACT_CITY),
    linkedin: optional(process.env.NEXT_PUBLIC_LINKEDIN_URL),
  },
  founder: {
    /** Nom complet du fondateur, à renseigner avant publication. */
    name: optional(process.env.NEXT_PUBLIC_FOUNDER_NAME),
    /** Chemin d'une photo placée dans /public (ex. /images/fondateur.jpg). */
    photo: optional(process.env.NEXT_PUBLIC_FOUNDER_PHOTO),
  },
  privacyOfficer: {
    /** Responsable de la protection des renseignements personnels (Loi 25). */
    name: optional(process.env.NEXT_PUBLIC_PRIVACY_OFFICER_NAME),
    email: optional(process.env.NEXT_PUBLIC_PRIVACY_OFFICER_EMAIL),
  },
  legalName: optional(process.env.NEXT_PUBLIC_LEGAL_NAME),
} as const;
