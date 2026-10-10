import { notFound } from "next/navigation";
import { CtaBand, MethodTimeline, PageHero } from "@/components/sections";
import { Index, Section, SectionHeading } from "@/components/ui";
import { getDictionary } from "@/content";
import { href, isLocale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/method">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({ locale, route: "method", ...getDictionary(locale).pages.method });
}

export default async function MethodPage({ params }: PageProps<"/[locale]/method">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { page, steps } = dict.method;

  return (
    <>
      <PageHero eyebrow={page.eyebrow} title={page.title} intro={page.intro} />

      <Section labelledBy="steps-title">
        <h2 id="steps-title" className="sr-only">
          {dict.home.method.title}
        </h2>
        <MethodTimeline steps={steps} stepLabel={dict.common.stepLabel} outputsLabel={page.outputsLabel} detailed />
      </Section>

      {/* Cycle : visualisation circulaire des cinq étapes */}
      <Section tone="night" labelledBy="cycle-title">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <SectionHeading id="cycle-title" title={page.cycleTitle} intro={page.cycleBody} dark />
          </div>
          <figure aria-hidden="true" className="mx-auto w-full max-w-lg">
            <svg viewBox="-90 -10 580 420" className="w-full">
              <circle cx="200" cy="200" r="140" fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="1" />
              <circle
                cx="200"
                cy="200"
                r="140"
                fill="none"
                stroke="var(--avoryn-champagne)"
                strokeWidth="1.5"
                strokeDasharray="6 10"
              />
              {steps.map((step, i) => {
                const angle = (i / steps.length) * 2 * Math.PI - Math.PI / 2;
                const x = 200 + 140 * Math.cos(angle);
                const y = 200 + 140 * Math.sin(angle);
                const lx = 200 + 186 * Math.cos(angle);
                const ly = 200 + 186 * Math.sin(angle) + 4;
                return (
                  <g key={step.title}>
                    <circle cx={x} cy={y} r="20" fill="var(--avoryn-night)" stroke="var(--avoryn-champagne)" strokeWidth="1.5" />
                    <text x={x} y={y + 4} textAnchor="middle" fontSize="12" fill="var(--avoryn-champagne)" fontFamily="ui-monospace, monospace">
                      {String(i + 1).padStart(2, "0")}
                    </text>
                    <text
                      x={lx}
                      y={ly}
                      textAnchor={Math.abs(Math.cos(angle)) < 0.2 ? "middle" : Math.cos(angle) > 0 ? "start" : "end"}
                      fontSize="13"
                      fontWeight="600"
                      fill="white"
                    >
                      {step.title}
                    </text>
                  </g>
                );
              })}
              <text x="200" y="196" textAnchor="middle" fontSize="13" fill="rgb(255 255 255 / 0.75)" letterSpacing="3">
                AVORYN
              </text>
              <text x="200" y="216" textAnchor="middle" fontSize="11" fill="var(--avoryn-champagne)">
                ↻
              </text>
            </svg>
          </figure>
        </div>
      </Section>

      <Section tone="mist" labelledBy="principles-title">
        <SectionHeading id="principles-title" title={page.principlesTitle} />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {page.principles.map((p, i) => (
            <li key={p.title} className="rounded-sm border border-line bg-white p-7">
              <Index n={i + 1} />
              <h3 className="mt-4 text-lg font-semibold text-ink">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{p.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand
        title={dict.home.contact.title}
        body={dict.home.contact.body}
        primary={{ href: `${href(locale, "contact")}?type=project`, label: dict.common.discussProject }}
      />
    </>
  );
}
