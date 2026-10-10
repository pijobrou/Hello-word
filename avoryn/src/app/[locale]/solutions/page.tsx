import { notFound } from "next/navigation";
import { CtaBand, PageHero } from "@/components/sections";
import { Container, DashList, Index } from "@/components/ui";
import { getDictionary } from "@/content";
import { href, isLocale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/solutions">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({ locale, route: "solutions", ...getDictionary(locale).pages.solutions });
}

export default async function SolutionsPage({ params }: PageProps<"/[locale]/solutions">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { solutions } = dict;

  return (
    <>
      <PageHero {...solutions.hero} />

      {/* Sommaire */}
      <nav aria-label={solutions.hero.eyebrow} className="surface-white border-b border-line">
        <Container>
          <ul className="flex gap-x-8 overflow-x-auto py-2 text-sm whitespace-nowrap">
            {solutions.items.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="inline-flex min-h-11 items-center text-ink hover:underline hover:decoration-champagne hover:underline-offset-8">
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </nav>

      {solutions.items.map((item, i) => (
        <section
          key={item.id}
          id={item.id}
          aria-labelledby={`${item.id}-title`}
          className={`${i % 2 === 0 ? "surface-white" : "surface-mist"} scroll-mt-24 py-16 sm:py-24`}
        >
          <Container className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <Index n={i + 1} />
              <h2 id={`${item.id}-title`} className="mt-4 text-3xl font-semibold tracking-tight text-balance text-ink">
                {item.title}
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted">{item.summary}</p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-sm border border-line bg-line md:grid-cols-3 lg:col-span-8">
              <div className="bg-white p-7">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">{solutions.labels.problems}</h3>
                <DashList items={item.problems} className="mt-5 text-sm text-ink" />
              </div>
              <div className="bg-white p-7">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">{solutions.labels.deliverables}</h3>
                <DashList items={item.deliverables} className="mt-5 text-sm text-ink" />
              </div>
              <div className="bg-white p-7">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">{solutions.labels.method}</h3>
                <p className="mt-5 text-sm leading-relaxed text-ink">{item.method}</p>
              </div>
            </div>
          </Container>
        </section>
      ))}

      <CtaBand
        title={solutions.cta.title}
        body={solutions.cta.body}
        primary={{ href: `${href(locale, "contact")}?type=project`, label: dict.common.discussProject }}
        secondary={{ href: href(locale, "method"), label: dict.home.method.cta }}
      />
    </>
  );
}
