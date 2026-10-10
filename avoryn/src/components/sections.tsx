import Image from "next/image";
import type { ReactNode } from "react";
import { BrandSymbol } from "@/components/brand/Logo";
import { ButtonLink, Container, DashList, Eyebrow } from "@/components/ui";

/* ------------------------------------------------------------------------ */
/* En-tête de page intérieure                                                 */
/* ------------------------------------------------------------------------ */

export function PageHero({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <section className="surface-night relative isolate overflow-hidden">
      <div aria-hidden="true" className="grid-veil absolute inset-0 -z-10" />
      <BrandSymbol className="pointer-events-none absolute top-1/2 -right-24 -z-10 hidden h-[26rem] w-auto -translate-y-1/2 text-white/[0.04] md:block" />
      <Container className="py-20 sm:py-28">
        <div className="max-w-3xl motion-safe:animate-rise">
          <Eyebrow dark>{eyebrow}</Eyebrow>
          <h1 className="mt-6 text-display font-semibold text-balance text-white">{title}</h1>
          {intro ? <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted text-pretty sm:text-xl">{intro}</p> : null}
          {children ? <div className="mt-10 flex flex-wrap gap-4">{children}</div> : null}
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Méthode en cinq étapes                                                     */
/* ------------------------------------------------------------------------ */

type Step = { title: string; summary: string; body: string; outputs: string[] };

function StepMarker({ n, dark }: { n: number; dark: boolean }) {
  return (
    <span className="relative inline-flex size-14 shrink-0 items-center justify-center">
      <svg viewBox="0 0 56 56" aria-hidden="true" className="absolute inset-0 size-full">
        <polygon
          points="16,2 40,2 54,16 54,40 40,54 16,54 2,40 2,16"
          fill={dark ? "var(--avoryn-night)" : "var(--avoryn-white)"}
          stroke="var(--avoryn-champagne)"
          strokeWidth="1.5"
        />
      </svg>
      <span className={`relative font-mono text-sm font-medium ${dark ? "text-champagne" : "text-ink"}`}>
        {String(n).padStart(2, "0")}
      </span>
    </span>
  );
}

export function MethodTimeline({
  steps,
  stepLabel,
  detailed = false,
  outputsLabel,
  dark = false,
}: {
  steps: Step[];
  stepLabel: string;
  detailed?: boolean;
  outputsLabel?: string;
  dark?: boolean;
}) {
  return (
    <ol className="relative grid gap-10 lg:grid-cols-5 lg:gap-6">
      {/* Fil conducteur : vertical sur mobile, horizontal sur grand écran */}
      <span
        aria-hidden="true"
        className="absolute top-7 bottom-7 left-7 w-px bg-linear-to-b from-champagne via-champagne/60 to-champagne/20 lg:top-7 lg:right-[10%] lg:bottom-auto lg:left-[10%] lg:h-px lg:w-auto lg:bg-linear-to-r"
      />
      {steps.map((step, i) => (
        <li key={step.title} className="relative flex gap-6 lg:flex-col lg:gap-6">
          <StepMarker n={i + 1} dark={dark} />
          <div className="lg:pr-2">
            <p className="sr-only">
              {stepLabel} {i + 1}
            </p>
            <h3 className={`text-xl font-semibold ${dark ? "text-white" : "text-ink"}`}>{step.title}</h3>
            <p className={`mt-2 leading-relaxed ${dark ? "text-white/90" : "text-ink"}`}>{step.summary}</p>
            {detailed ? (
              <>
                <p className="mt-3 text-sm leading-relaxed text-muted">{step.body}</p>
                {outputsLabel ? (
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{outputsLabel}</p>
                ) : null}
                <DashList items={step.outputs} className="mt-3 text-sm" />
              </>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------------ */
/* Bandeau d'appel à l'action                                                 */
/* ------------------------------------------------------------------------ */

export function CtaBand({
  eyebrow,
  title,
  body,
  primary,
  secondary,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <section className="surface-navy relative isolate overflow-hidden">
      <BrandSymbol className="pointer-events-none absolute -bottom-16 -left-16 -z-10 h-72 w-auto text-white/[0.04]" />
      <Container className="py-20 sm:py-24">
        <div className="grid items-end gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            {eyebrow ? <Eyebrow dark>{eyebrow}</Eyebrow> : null}
            <h2 className="mt-5 text-headline font-semibold text-balance text-white">{title}</h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{body}</p>
          </div>
          <div className="flex flex-wrap gap-4 lg:col-span-4 lg:justify-end">
            <ButtonLink href={primary.href} variant="gold" arrow>
              {primary.label}
            </ButtonLink>
            {secondary ? (
              <ButtonLink href={secondary.href} variant="outlineLight">
                {secondary.label}
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Portrait du fondateur                                                      */
/* ------------------------------------------------------------------------ */

export function FounderPortrait({ photo, alt, className = "" }: { photo: string | null; alt: string; className?: string }) {
  return (
    <div className={`relative aspect-[4/5] overflow-hidden rounded-sm bg-night ${className}`}>
      {photo ? (
        <Image src={photo} alt={alt} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
      ) : (
        // Emplacement réservé à la photographie fournie par le fondateur.
        <div className="grid-veil absolute inset-0 flex items-center justify-center">
          <BrandSymbol className="h-auto w-1/2 text-champagne/70" />
        </div>
      )}
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-champagne" />
    </div>
  );
}
