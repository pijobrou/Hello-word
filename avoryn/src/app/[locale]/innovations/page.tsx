import { notFound } from "next/navigation";
import { CtaBand, PageHero } from "@/components/sections";
import { Badge, Index, Section, SectionHeading } from "@/components/ui";
import { getDictionary } from "@/content";
import { publishedProjects, type ProjectStatus } from "@/content/projects";
import { href, isLocale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";

const STATUSES: ProjectStatus[] = ["concept", "research", "prototype", "development", "available"];

export async function generateMetadata({ params }: PageProps<"/[locale]/innovations">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({ locale, route: "innovations", ...getDictionary(locale).pages.innovations });
}

export default async function InnovationsPage({ params }: PageProps<"/[locale]/innovations">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { innovations: inn } = dict;
  const projects = publishedProjects();
  const statusLabel = (s: string) => inn.statuses[s as ProjectStatus]?.label ?? s;

  return (
    <>
      <PageHero {...inn.hero} />

      {/* Échelle des états d'avancement */}
      <Section labelledBy="status-title">
        <SectionHeading id="status-title" title={inn.statusTitle} intro={inn.statusIntro} />
        <ol className="mt-14 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
          {STATUSES.map((s, i) => (
            <li key={s} className="relative bg-white p-6">
              <div className="flex items-center gap-1.5" aria-hidden="true">
                {STATUSES.map((_, j) => (
                  <span key={j} className={`h-1 flex-1 rounded-full ${j <= i ? "bg-champagne" : "bg-line"}`} />
                ))}
              </div>
              <p className="mt-5 font-mono text-xs text-slate">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">{inn.statuses[s].label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{inn.statuses[s].body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Axes d'exploration */}
      <Section tone="mist" labelledBy="axes-title">
        <SectionHeading id="axes-title" title={inn.axesTitle} intro={inn.axesIntro} />
        <ul className="mt-14 grid gap-6 md:grid-cols-3">
          {inn.axes.map((axis, i) => (
            <li key={axis.title} className="flex flex-col rounded-sm border border-line bg-white p-8">
              <div className="flex items-center justify-between gap-4">
                <Index n={i + 1} />
                <Badge>{statusLabel(axis.status)}</Badge>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-ink">{axis.title}</h3>
              <p className="mt-3 leading-relaxed text-slate">{axis.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Projets */}
      <Section labelledBy="projects-title">
        <SectionHeading id="projects-title" title={inn.projectsTitle} />
        {projects.length === 0 ? (
          <div className="mt-10 rounded-sm border border-dashed border-slate p-10 text-center">
            <p className="mx-auto max-w-xl leading-relaxed text-ink">{inn.projectsEmpty}</p>
          </div>
        ) : (
          <ul className="mt-10 grid gap-6 md:grid-cols-2">
            {projects.map((p) => (
              <li key={p.id} className="rounded-sm border border-line p-8">
                <Badge tone="gold">{statusLabel(p.status)}</Badge>
                <h3 className="mt-5 text-xl font-semibold text-ink">{p[locale].title}</h3>
                <p className="mt-3 leading-relaxed text-muted">{p[locale].summary}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-8 text-sm text-muted">{inn.note}</p>
      </Section>

      <CtaBand
        title={dict.home.contact.title}
        body={dict.home.contact.body}
        primary={{ href: `${href(locale, "contact")}?type=partnership`, label: dict.home.contact.secondary }}
      />
    </>
  );
}
