import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand, PageHero } from "@/components/sections";
import { ArrowIcon, Container, DashList, Index } from "@/components/ui";
import { getDictionary } from "@/content";
import { href, isLocale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { sectorKeys, sectorSlugs } from "@/lib/slugs";

export async function generateMetadata({ params }: PageProps<"/[locale]/sectors">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({ locale, route: "sectors", ...getDictionary(locale).pages.sectors });
}

export default async function SectorsPage({ params }: PageProps<"/[locale]/sectors">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { sectors } = dict;

  return (
    <>
      <PageHero {...sectors.hero} />
      <section className="surface-mist py-16 sm:py-24" aria-label={sectors.hero.eyebrow}>
        <Container>
          <ul className="grid gap-6 md:grid-cols-2">
            {sectorKeys.map((key, i) => {
              const s = sectors.items[key];
              return (
                <li key={key} className="flex flex-col rounded-sm border border-line bg-white p-8 sm:p-10">
                  <Index n={i + 1} />
                  <h2 className="mt-4 text-2xl font-semibold text-ink">{s.title}</h2>
                  <p className="mt-2 text-slate">{s.summary}</p>
                  <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-slate">
                    {sectors.labels.challenges}
                  </h3>
                  <DashList items={s.challenges} className="mt-4 flex-1 text-sm text-ink" />
                  <Link
                    href={href(locale, "sectors", sectorSlugs[key][locale])}
                    className="group mt-8 inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-ink underline decoration-champagne underline-offset-[6px]"
                  >
                    {sectors.labels.explore}
                    <span className="sr-only"> : {s.title}</span>
                    <ArrowIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-12 max-w-3xl text-sm leading-relaxed text-muted">{sectors.disclaimer}</p>
        </Container>
      </section>
      <CtaBand
        title={dict.home.contact.title}
        body={dict.home.contact.body}
        primary={{ href: `${href(locale, "contact")}?type=project`, label: dict.common.discussProject }}
      />
    </>
  );
}
