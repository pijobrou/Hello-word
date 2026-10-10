import { notFound } from "next/navigation";
import { CtaBand, FounderPortrait, PageHero } from "@/components/sections";
import { DashList, Eyebrow, Index, Section, SectionHeading } from "@/components/ui";
import { getDictionary } from "@/content";
import { href, isLocale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({ locale, route: "about", ...getDictionary(locale).pages.about });
}

export default async function AboutPage({ params }: PageProps<"/[locale]/about">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { about } = dict;
  const quote = locale === "fr" ? `« ${about.founder.quote} »` : `“${about.founder.quote}”`;

  return (
    <>
      <PageHero {...about.hero} />

      {/* Histoire */}
      <Section labelledBy="story-title">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading id="story-title" title={about.story.title} />
          </div>
          <div className="space-y-5 text-lg leading-relaxed text-ink lg:col-span-7 lg:col-start-6">
            {about.story.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </Section>

      {/* Ambition, mission, vision */}
      <Section tone="night" labelledBy="pillars-title">
        <h2 id="pillars-title" className="sr-only">
          {about.ambition.title} · {about.mission.title} · {about.vision.title}
        </h2>
        <div className="grid gap-px overflow-hidden rounded-sm bg-white/10 lg:grid-cols-3">
          {[about.ambition, about.mission, about.vision].map((block, i) => (
            <div key={block.title} className="bg-night p-8 sm:p-10">
              <Index n={i + 1} dark />
              <h3 className="mt-6 text-2xl font-semibold text-white">{block.title}</h3>
              <p className="mt-4 leading-relaxed text-muted">{block.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Valeurs */}
      <Section labelledBy="values-title">
        <SectionHeading id="values-title" eyebrow={about.values.eyebrow} title={about.values.title} />
        <ul className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {about.values.items.map((value, i) => (
            <li key={value.title} className="border-t border-ink/15 pt-6">
              <Index n={i + 1} />
              <h3 className="mt-4 text-lg font-semibold text-ink">{value.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{value.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Fondateur */}
      <Section tone="mist" id="founder" labelledBy="founder-title">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <FounderPortrait photo={site.founder.photo} alt={about.founder.photoAlt} className="max-w-md lg:sticky lg:top-28 lg:max-w-none" />
          </div>
          <div className="lg:col-span-7">
            <Eyebrow>{about.founder.eyebrow}</Eyebrow>
            <h2 id="founder-title" className="mt-5 text-headline font-semibold text-ink">
              {about.founder.title}
            </h2>
            <p className="mt-4 text-sm font-semibold text-ink">
              {site.founder.name ?? about.founder.nameFallback}
              <span className="font-normal text-muted"> — {about.founder.role}, AVORYN</span>
            </p>
            <blockquote className="mt-8 border-l-2 border-champagne pl-6 text-xl leading-relaxed font-medium text-ink sm:text-2xl">
              {quote}
            </blockquote>
            <div className="mt-8 space-y-4 leading-relaxed text-ink">
              {about.founder.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <h3 className="mt-12 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              {about.founder.journeyTitle}
            </h3>
            <DashList items={about.founder.journey} className="mt-5 grid gap-x-8 text-ink sm:grid-cols-2 sm:space-y-0 sm:gap-y-3" />
          </div>
        </div>
      </Section>

      {/* Approche */}
      <Section labelledBy="approach-title">
        <SectionHeading id="approach-title" eyebrow={about.approach.eyebrow} title={about.approach.title} />
        <ul className="mt-14 grid gap-6 sm:grid-cols-2">
          {about.approach.items.map((item, i) => (
            <li key={item.title} className="rounded-sm border border-line p-8">
              <Index n={i + 1} />
              <h3 className="mt-4 text-lg font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Vision à long terme */}
      <Section tone="mist" labelledBy="longterm-title">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading id="longterm-title" eyebrow={about.longTerm.eyebrow} title={about.longTerm.title} />
          </div>
          <div className="lg:col-span-7">
            <p className="text-lg leading-relaxed text-ink">{about.longTerm.body}</p>
            <ol className="mt-10 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-3">
              {dict.home.vision.horizons.map((h, i) => (
                <li key={h.label} className="bg-white p-6">
                  <Index n={i + 1} />
                  <p className="mt-3 font-semibold text-ink">{h.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{h.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      <CtaBand
        eyebrow={dict.home.contact.eyebrow}
        title={dict.home.contact.title}
        body={dict.home.contact.body}
        primary={{ href: href(locale, "contact"), label: dict.common.discussProject }}
      />
    </>
  );
}
