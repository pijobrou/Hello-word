import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/ContactForm";
import { JsonLd } from "@/components/JsonLd";
import { PageHero } from "@/components/sections";
import { ArrowIcon, Container, DashList } from "@/components/ui";
import { getDictionary } from "@/content";
import { href, isLocale, locales, type Locale } from "@/lib/i18n";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { sectorFromSlug, sectorKeys, sectorSlugs } from "@/lib/slugs";

export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { locale: string } }) {
  const locale = (isLocale(params.locale) ? params.locale : "fr") as Locale;
  return sectorKeys.map((key) => ({ slug: sectorSlugs[key][locale] }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/sectors/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const key = sectorFromSlug(locale, slug);
  if (!key) return {};
  const sector = getDictionary(locale).sectors.items[key];
  return buildMetadata({
    locale,
    route: "sectors",
    rest: Object.fromEntries(locales.map((l) => [l, [sectorSlugs[key][l]]])) as Record<Locale, string[]>,
    title: sector.title,
    description: `${sector.summary} ${sector.intro}`,
  });
}

export default async function SectorPage({ params }: PageProps<"/[locale]/sectors/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const key = sectorFromSlug(locale, slug);
  if (!key) notFound();
  const dict = getDictionary(locale);
  const { sectors } = dict;
  const sector = sectors.items[key];

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: dict.nav.home, item: absoluteUrl(href(locale, "home")) },
      { "@type": "ListItem", position: 2, name: dict.nav.sectors, item: absoluteUrl(href(locale, "sectors")) },
      { "@type": "ListItem", position: 3, name: sector.title, item: absoluteUrl(href(locale, "sectors", slug)) },
    ],
  };

  return (
    <>
      <PageHero eyebrow={sectors.hero.eyebrow} title={sector.title} intro={sector.intro} />

      <section className="surface-white py-16 sm:py-24" aria-label={sector.title}>
        <Container>
          <nav aria-label={dict.nav.breadcrumb} className="mb-12 text-sm">
            <ol className="flex flex-wrap items-center gap-2 text-slate">
              <li>
                <Link href={href(locale, "home")} className="underline-offset-4 hover:underline">
                  {dict.nav.home}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={href(locale, "sectors")} className="underline-offset-4 hover:underline">
                  {dict.nav.sectors}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-ink">
                {sector.title}
              </li>
            </ol>
          </nav>
          <div className="grid gap-px overflow-hidden rounded-sm border border-line bg-line md:grid-cols-2">
            <div className="bg-white p-8 sm:p-10">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">{sectors.labels.challenges}</h2>
              <DashList items={sector.challenges} className="mt-6 text-lg text-ink" />
            </div>
            <div className="bg-white p-8 sm:p-10">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">{sectors.labels.support}</h2>
              <DashList items={sector.support} className="mt-6 text-lg text-ink" />
            </div>
          </div>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-slate">{sectors.disclaimer}</p>
        </Container>
      </section>

      <section className="surface-mist py-16 sm:py-24" aria-labelledby="sector-form-title">
        <Container className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 id="sector-form-title" className="text-3xl font-semibold tracking-tight text-ink">
              {sectors.labels.formTitle}
            </h2>
            <p className="mt-4 leading-relaxed text-muted">{sectors.labels.formIntro}</p>
            <Link
              href={href(locale, "sectors")}
              className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink underline decoration-champagne underline-offset-[6px]"
            >
              <ArrowIcon className="size-4 rotate-180" />
              {dict.common.allSectors}
            </Link>
          </div>
          <div className="lg:col-span-8">
            <ContactForm
              locale={locale}
              labels={dict.contact.form}
              sectors={sectorKeys.map((k) => ({ key: k, label: sectors.items[k].title }))}
              privacyHref={href(locale, "privacy")}
              defaultType="project"
              fixedSector={key}
            />
          </div>
        </Container>
      </section>
      <JsonLd data={breadcrumbs} />
    </>
  );
}
