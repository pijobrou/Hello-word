/**
 * Projets présentés sur la page Innovations.
 *
 * La liste est volontairement vide : un projet n'est ajouté (published: true)
 * qu'une fois son état d'avancement réel confirmé par le fondateur.
 * Ne pas présenter BVY Accounting, GovBid, CuddleNest ou toute autre initiative
 * comme filiale d'AVORYN sans confirmation juridique.
 *
 * Exemple :
 * {
 *   id: "exemple",
 *   status: "research",
 *   published: false,
 *   fr: { title: "Nom du projet", summary: "Description factuelle." },
 *   en: { title: "Project name", summary: "Factual description." },
 * }
 */
import type { Locale } from "@/lib/i18n";

export type ProjectStatus = "concept" | "research" | "prototype" | "development" | "available";

export type Project = {
  id: string;
  status: ProjectStatus;
  published: boolean;
} & Record<Locale, { title: string; summary: string }>;

export const projects: Project[] = [];

export function publishedProjects(): Project[] {
  return projects.filter((p) => p.published);
}
