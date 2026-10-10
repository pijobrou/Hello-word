import { notFound } from "next/navigation";
import { PageHero } from "@/components/sections";
import { Container } from "@/components/ui";
import { getDictionary } from "@/content";
import { isLocale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({ locale, route: "privacy", ...getDictionary(locale).pages.privacy });
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { privacy } = getDictionary(locale);
  const todo = privacy.toComplete;

  // Valeurs à renseigner via l'environnement ; jamais inventées.
  const fields: Record<string, string> = {
    legalName: site.legalName ?? `${todo} (${locale === "fr" ? "nom légal de l’entreprise" : "legal business name"})`,
    officerName: site.privacyOfficer.name ?? todo,
    officerEmail: site.privacyOfficer.email ?? todo,
    hostingProvider: todo,
    emailProvider: todo,
    retention: todo,
  };
  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (_, key: string) => fields[key] ?? todo);

  return (
    <>
      <PageHero {...privacy.hero} />
      <Container className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <p role="note" className="border-l-2 border-champagne bg-mist p-5 text-sm leading-relaxed text-ink">
            {privacy.draftNotice}
          </p>
          <p className="mt-6 text-sm text-slate">{privacy.lastUpdated}</p>
          <div className="prose-avoryn mt-4 leading-relaxed text-ink">
            {privacy.sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((p) => (
                  <p key={p}>{fill(p)}</p>
                ))}
                {"list" in section && section.list ? (
                  <ul>
                    {section.list.map((item) => (
                      <li key={item}>{fill(item)}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
