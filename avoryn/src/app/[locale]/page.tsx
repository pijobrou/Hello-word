import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandSymbol, Logo } from "@/components/brand/Logo";
import { CtaBand, FounderPortrait, MethodTimeline } from "@/components/sections";
import { ArrowIcon, ButtonLink, Container, Eyebrow, Index, Section, SectionHeading, TextLink } from "@/components/ui";
import { getDictionary } from "@/content";
import { href, isLocale, type RouteKey } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import { sectorKeys, sectorSlugs } from "@/lib/slugs";

export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { pages } = getDictionary(locale);
  return buildMetadata({ locale, route: "home", ...pages.home, absoluteTitle: true });
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { home } = dict;

  return (
    <>
      {/* 1 — Hero */}
      <section className="surface-night relative isolate overflow-hidden" aria-labelledby="hero-title">
        <div aria-hidden="true" className="grid-veil absolute inset-0 -z-10" />
        <Container className="grid items-center gap-16 py-20 sm:py-28 lg:grid-cols-12 lg:py-32">
          <div className="lg:col-span-7">
            <div className="motion-safe:animate-rise">
              <Logo className="text-[1.35rem] text-champagne sm:text-[1.6rem]" title={dict.meta.siteName} />
              <p className="mt-6 flex items-center gap-4 text-base font-medium text-white sm:text-lg">
                <span aria-hidden="true" className="gold-rule" />
                {dict.meta.slogan}
              </p>
            </div>
            <h1
              id="hero-title"
              className="mt-12 text-display font-semibold text-balance text-white motion-safe:animate-rise motion-safe:[animation-delay:120ms]"
            >
              {home.hero.title}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted text-pretty sm:text-xl motion-safe:animate-rise motion-safe:[animation-delay:220ms]">
              {home.hero.subtitle}
            </p>
            <div className="mt-10 flex flex-wrap gap-4 motion-safe:animate-rise motion-safe:[animation-delay:320ms]">
              <ButtonLink href={href(locale, "solutions")} variant="gold" arrow>
                {dict.common.discoverSolutions}
              </ButtonLink>
              <ButtonLink href={href(locale, "contact")} variant="outlineLight">
                {dict.common.discussProject}
              </ButtonLink>
            </div>
            <p className="mt-14 text-xs font-medium uppercase tracking-[0.22em] text-muted">{home.hero.eyebrow}</p>
          </div>
          <div aria-hidden="true" className="relative hidden lg:col-span-5 lg:block">
            <div className="relative mx-auto aspect-square max-w-md">
              <svg viewBox="0 0 400 400" className="absolute inset-0 size-full text-white/10">
                <g fill="none" stroke="currentColor" strokeWidth="1">
                  <polygon points="117,10 283,10 390,117 390,283 283,390 117,390 10,283 10,117" />
                  <polygon points="140,64 260,64 336,140 336,260 260,336 140,336 64,260 64,140" />
                </g>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <BrandSymbol className="h-auto w-3/5 text-champagne motion-safe:animate-rise motion-safe:[animation-delay:200ms]" />
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* 2 — Présentation */}
      <Section labelledBy="intro-title">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading id="intro-title" eyebrow={home.intro.eyebrow} title={home.intro.title} />
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <div className="space-y-5 text-lg leading-relaxed text-ink">
              {home.intro.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <dl className="mt-10 grid gap-6 border-t border-line pt-8 sm:grid-cols-3">
              {home.intro.facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{fact.label}</dt>
                  <dd className="mt-2 font-medium text-ink">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      {/* 3 — Vision */}
      <Section tone="mist" labelledBy="vision-title">
        <SectionHeading id="vision-title" eyebrow={home.vision.eyebrow} title={home.vision.title} intro={home.vision.body} />
        <ol className="mt-14 grid gap-px overflow-hidden rounded-sm border border-line bg-line md:grid-cols-3">
          {home.vision.horizons.map((h, i) => (
            <li key={h.label} className="bg-white p-8">
              <div className="flex items-center gap-3">
                <Index n={i + 1} />
                <span aria-hidden="true" className="h-px flex-1 bg-line" />
              </div>
              <h3 className="mt-6 text-lg font-semibold text-ink">{h.label}</h3>
              <p className="mt-2 leading-relaxed text-muted">{h.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* 4 — Défis */}
      <Section labelledBy="challenges-title">
        <SectionHeading id="challenges-title" eyebrow={home.challenges.eyebrow} title={home.challenges.title} />
        <ul className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {home.challenges.items.map((item, i) => (
            <li key={item.title} className="border-t border-ink/15 pt-6">
              <Index n={i + 1} />
              <h3 className="mt-4 text-lg font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* 5 — Expertises */}
      <Section tone="night" labelledBy="expertise-title">
        <SectionHeading id="expertise-title" eyebrow={home.expertise.eyebrow} title={home.expertise.title} dark />
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {home.expertise.items.map((item, i) => (
            <Link
              key={item.title}
              href={href(locale, item.route as RouteKey)}
              className="group flex flex-col rounded-sm border border-white/12 bg-white/[0.02] p-8 transition-colors duration-300 hover:border-champagne/60 hover:bg-white/[0.04]"
            >
              <Index n={i + 1} dark />
              <h3 className="mt-6 text-2xl font-semibold text-white">{item.title}</h3>
              <p className="mt-3 flex-1 leading-relaxed text-muted">{item.body}</p>
              <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-champagne">
                {item.cta}
                <ArrowIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* 6 — Méthode */}
      <Section tone="mist" labelledBy="method-title">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeading id="method-title" eyebrow={home.method.eyebrow} title={home.method.title} intro={home.method.body} />
          <TextLink href={href(locale, "method")} className="shrink-0 text-ink">
            {home.method.cta}
          </TextLink>
        </div>
        <div className="mt-16">
          <MethodTimeline steps={dict.method.steps} stepLabel={dict.common.stepLabel} />
        </div>
      </Section>

      {/* 7 — Technologies */}
      <Section labelledBy="tech-title">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading id="tech-title" eyebrow={home.technologies.eyebrow} title={home.technologies.title} intro={home.technologies.body} />
            <TextLink href={href(locale, "technologies")} className="mt-8 text-ink">
              {home.technologies.cta}
            </TextLink>
          </div>
          <ul className="grid self-start gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:col-span-6 lg:col-start-7">
            {home.technologies.items.map((item, i) => (
              <li key={item} className="flex items-center gap-4 bg-white px-6 py-6">
                <Index n={i + 1} />
                <span className="font-medium text-ink">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 8 — Secteurs */}
      <Section tone="mist" labelledBy="sectors-title">
        <SectionHeading id="sectors-title" eyebrow={home.sectors.eyebrow} title={home.sectors.title} intro={home.sectors.body} />
        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sectorKeys.map((key) => {
            const sector = dict.sectors.items[key];
            return (
              <li key={key}>
                <Link
                  href={href(locale, "sectors", sectorSlugs[key][locale])}
                  className="group flex h-full flex-col rounded-sm border border-line bg-white p-7 transition-colors duration-300 hover:border-ink/40"
                >
                  <h3 className="text-lg font-semibold text-ink">{sector.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{sector.summary}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ink">
                    {dict.sectors.labels.explore}
                    <ArrowIcon className="size-4 text-ink transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* 9 — Fondateur */}
      <Section labelledBy="founder-title">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <FounderPortrait
            photo={site.founder.photo}
            alt={dict.about.founder.photoAlt}
            className="max-w-md lg:col-span-5 lg:max-w-none"
          />
          <div className="lg:col-span-7">
            <Eyebrow>{home.founder.eyebrow}</Eyebrow>
            <h2 id="founder-title" className="mt-5 text-headline font-semibold text-ink">
              {home.founder.title}
            </h2>
            <blockquote className="mt-8 border-l-2 border-champagne pl-6 text-xl leading-relaxed font-medium text-ink text-pretty sm:text-2xl">
              {locale === "fr" ? `« ${dict.about.founder.quote} »` : `“${dict.about.founder.quote}”`}
            </blockquote>
            <p className="mt-8 leading-relaxed text-muted">{home.founder.body}</p>
            <p className="mt-6 text-sm font-semibold text-ink">
              {site.founder.name ?? dict.about.founder.nameFallback}
              <span className="font-normal text-muted"> — {dict.about.founder.role}, AVORYN</span>
            </p>
            <TextLink href={`${href(locale, "about")}#founder`} className="mt-6 text-ink">
              {home.founder.cta}
            </TextLink>
          </div>
        </div>
      </Section>

      {/* 10 — Contact */}
      <CtaBand
        eyebrow={home.contact.eyebrow}
        title={home.contact.title}
        body={home.contact.body}
        primary={{ href: `${href(locale, "contact")}?type=project`, label: home.contact.primary }}
        secondary={{ href: `${href(locale, "contact")}?type=partnership`, label: home.contact.secondary }}
      />
    </>
  );
}
