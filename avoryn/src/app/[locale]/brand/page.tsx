/* eslint-disable @next/next/no-img-element -- les SVG de marque sont affichés tels quels */
import { notFound } from "next/navigation";
import { PageHero } from "@/components/sections";
import { DashList, Section, SectionHeading } from "@/components/ui";
import { getDictionary } from "@/content";
import { isLocale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/brand">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({ locale, route: "brand", ...getDictionary(locale).pages.brand, noindex: true });
}

const PRIMARY = [
  { key: "night", hex: "#101C2D", dark: true },
  { key: "champagne", hex: "#C8A96D", dark: false },
  { key: "white", hex: "#FFFFFF", dark: false },
] as const;

const SECONDARY = [
  { key: "mist", hex: "#F7F8FA", dark: false },
  { key: "ink", hex: "#172235", dark: true },
  { key: "slate", hex: "#64748B", dark: true },
  { key: "line", hex: "#E2E8F0", dark: false },
  { key: "navy", hex: "#24344B", dark: true },
] as const;

export default async function BrandPage({ params }: PageProps<"/[locale]/brand">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { brand } = getDictionary(locale);

  const logos = [
    { file: "avoryn-horizontal-gold-on-night", label: `${brand.variants.horizontal} — ${brand.variants.goldOnNight}`, bg: "bg-night" },
    { file: "avoryn-horizontal-night-on-white", label: `${brand.variants.horizontal} — ${brand.variants.nightOnWhite}`, bg: "bg-white" },
    { file: "avoryn-vertical-gold-on-night", label: `${brand.variants.vertical} — ${brand.variants.goldOnNight}`, bg: "bg-night" },
    { file: "avoryn-vertical-night-on-white", label: `${brand.variants.vertical} — ${brand.variants.nightOnWhite}`, bg: "bg-white" },
    { file: "avoryn-horizontal-mono-black", label: `${brand.variants.mono} (${locale === "fr" ? "noir" : "black"})`, bg: "bg-white" },
    { file: "avoryn-horizontal-mono-white", label: `${brand.variants.mono} (${locale === "fr" ? "blanc" : "white"})`, bg: "bg-navy" },
    { file: "avoryn-symbol-gold", label: brand.variants.symbol, bg: "bg-night" },
    { file: "avoryn-favicon", label: "Favicon", bg: "bg-white" },
  ];

  const swatch = (c: { key: keyof typeof brand.colors; hex: string; dark: boolean }) => (
    <li key={c.key} className="overflow-hidden rounded-sm border border-line">
      <div className="h-28" style={{ backgroundColor: c.hex }} />
      <div className="bg-white p-4">
        <p className="font-semibold text-ink">{brand.colors[c.key]}</p>
        <p className="mt-1 font-mono text-sm text-slate">{c.hex}</p>
      </div>
    </li>
  );

  return (
    <>
      <PageHero {...brand.hero} />

      <Section labelledBy="logo-title">
        <SectionHeading id="logo-title" title={brand.logoTitle} intro={brand.logoBody} />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2">
          {logos.map((logo) => (
            <li key={logo.file} className="overflow-hidden rounded-sm border border-line">
              <div className={`flex h-56 items-center justify-center p-8 ${logo.bg}`}>
                <img src={`/brand/${logo.file}.svg`} alt={logo.label} className="max-h-full max-w-full" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white p-4">
                <p className="text-sm font-medium text-ink">{logo.label}</p>
                <a href={`/brand/${logo.file}.svg`} download className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4">
                  {brand.download}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="mist" labelledBy="colors-title">
        <SectionHeading id="colors-title" title={brand.colorsTitle} intro={brand.colorsBody} />
        <h3 className="mt-12 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{brand.primary}</h3>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">{PRIMARY.map(swatch)}</ul>
        <h3 className="mt-10 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{brand.secondary}</h3>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">{SECONDARY.map(swatch)}</ul>
        <div className="mt-12 rounded-sm border border-line bg-white p-8">
          <h3 className="text-lg font-semibold text-ink">{brand.contrastTitle}</h3>
          <DashList items={brand.contrastRules} className="mt-4 text-ink" />
        </div>
      </Section>

      <Section labelledBy="type-title">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading id="type-title" title={brand.typeTitle} intro={brand.typeBody} />
            <div className="mt-10 space-y-4 border-t border-line pt-8">
              <p className="text-display font-semibold text-ink">Aa</p>
              <p className="text-headline font-semibold text-ink">L’ambition de créer.</p>
              <p className="text-lg text-ink">La vision de durer.</p>
            </div>
          </div>
          <div>
            <h2 className="mt-5 text-headline font-semibold text-ink">{brand.usageTitle}</h2>
            <DashList items={brand.usage} className="mt-8 text-lg text-ink" />
          </div>
        </div>
      </Section>
    </>
  );
}
