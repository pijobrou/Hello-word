import { notFound } from "next/navigation";
import { CtaBand, PageHero } from "@/components/sections";
import { Badge, Container, DashList, Index, Section, SectionHeading } from "@/components/ui";
import { getDictionary } from "@/content";
import { href, isLocale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/technologies">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({ locale, route: "technologies", ...getDictionary(locale).pages.technologies });
}

export default async function TechnologiesPage({ params }: PageProps<"/[locale]/technologies">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { technologies: t } = dict;

  return (
    <>
      <PageHero {...t.hero} />

      {/* Transparence sur l'état de l'offre */}
      <section className="surface-white border-b border-line">
        <Container className="py-10">
          <div className="flex flex-col gap-4 border-l-2 border-champagne pl-6 md:flex-row md:items-baseline md:gap-10">
            <h2 className="shrink-0 text-sm font-semibold uppercase tracking-[0.18em] text-ink">{t.notice.title}</h2>
            <p className="max-w-3xl leading-relaxed text-muted">{t.notice.body}</p>
          </div>
        </Container>
      </section>

      <section className="surface-white pb-20 sm:pb-28" aria-label={t.hero.eyebrow}>
        <Container>
          <ul className="divide-y divide-line">
            {t.items.map((item, i) => {
              const exploring = item.status === "exploration";
              return (
                <li key={item.id} id={item.id} className="grid scroll-mt-24 gap-8 py-14 lg:grid-cols-12">
                  <div className="lg:col-span-5">
                    <div className="flex items-center gap-4">
                      <Index n={i + 1} />
                      <Badge tone={exploring ? "light" : "gold"}>
                        {t.statusLabels[exploring ? "exploration" : "service"]}
                      </Badge>
                    </div>
                    <h2 className="mt-5 text-3xl font-semibold tracking-tight text-ink">{item.title}</h2>
                    <p className="mt-4 text-lg leading-relaxed text-muted">{item.summary}</p>
                  </div>
                  <div className="grid gap-8 sm:grid-cols-2 lg:col-span-6 lg:col-start-7">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t.labels.uses}</h3>
                      <DashList items={item.uses} className="mt-4 text-ink" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{t.labels.principle}</h3>
                      <p className="mt-4 leading-relaxed text-ink">{item.principle}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      <Section tone="night" labelledBy="responsible-title">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading id="responsible-title" eyebrow={t.responsible.eyebrow} title={t.responsible.title} dark />
          </div>
          <ul className="grid gap-px overflow-hidden rounded-sm bg-white/10 sm:grid-cols-2 lg:col-span-7">
            {t.responsible.items.map((item, i) => (
              <li key={item} className="bg-night p-7">
                <Index n={i + 1} dark />
                <p className="mt-4 leading-relaxed text-white">{item}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <CtaBand
        title={dict.home.contact.title}
        body={dict.home.contact.body}
        primary={{ href: `${href(locale, "contact")}?type=project`, label: dict.common.discussProject }}
      />
    </>
  );
}
