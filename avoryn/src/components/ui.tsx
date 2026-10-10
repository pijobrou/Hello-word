import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* ------------------------------------------------------------------------ */
/* Mise en page                                                               */
/* ------------------------------------------------------------------------ */

export function Container({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

export type Tone = "white" | "mist" | "night" | "navy";

export function isDark(tone: Tone): boolean {
  return tone === "night" || tone === "navy";
}

export function Section({
  tone = "white",
  className = "",
  children,
  id,
  labelledBy,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  id?: string;
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`surface-${tone} py-20 sm:py-28 ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Typographie                                                                */
/* ------------------------------------------------------------------------ */

export function Eyebrow({ children, dark = false, className = "" }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <p
      className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] ${
        dark ? "text-champagne" : "text-muted"
      } ${className}`}
    >
      <span aria-hidden="true" className="gold-rule w-8" />
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  id,
  dark = false,
  align = "left",
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  id?: string;
  dark?: boolean;
  align?: "left" | "center";
  as?: "h1" | "h2";
}) {
  const centered = align === "center";
  return (
    <div className={`max-w-3xl ${centered ? "mx-auto text-center [&>p:first-child]:justify-center" : ""}`}>
      {eyebrow ? <Eyebrow dark={dark}>{eyebrow}</Eyebrow> : null}
      <Tag id={id} className={`mt-5 text-headline font-semibold text-balance ${dark ? "text-white" : "text-ink"}`}>
        {title}
      </Tag>
      {intro ? <p className="mt-5 text-lg leading-relaxed text-muted text-pretty">{intro}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Actions                                                                    */
/* ------------------------------------------------------------------------ */

const buttonBase =
  "group inline-flex min-h-12 items-center justify-center gap-2 rounded-sm px-6 text-sm font-semibold tracking-wide transition-colors duration-200";

const buttonVariants = {
  gold: "bg-champagne text-night hover:bg-white",
  night: "bg-night text-white hover:bg-navy",
  outlineLight: "border border-white/40 text-white hover:border-champagne hover:text-champagne",
  outlineDark: "border border-ink/30 text-ink hover:border-ink hover:bg-ink hover:text-white",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

export function buttonClass(variant: ButtonVariant = "night", className = ""): string {
  return `${buttonBase} ${buttonVariants[variant]} ${className}`;
}

export function ButtonLink({
  variant = "night",
  className = "",
  arrow = false,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; arrow?: boolean }) {
  return (
    <Link className={buttonClass(variant, className)} {...props}>
      {children}
      {arrow ? <ArrowIcon className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" /> : null}
    </Link>
  );
}

/** Lien texte souligné par un filet, avec flèche. */
export function TextLink({ className = "", children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={`group inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline decoration-champagne decoration-1 underline-offset-[6px] hover:decoration-2 ${className}`}
      {...props}
    >
      {children}
      <ArrowIcon className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

/* ------------------------------------------------------------------------ */
/* Éléments                                                                   */
/* ------------------------------------------------------------------------ */

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-sm border border-line bg-white p-7 sm:p-8 ${className}`}>{children}</div>;
}

export function Badge({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "gold" | "dark" }) {
  const tones = {
    light: "border-ink/20 text-ink",
    gold: "border-champagne bg-night text-champagne",
    dark: "border-white/30 text-white",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Index éditorial « 01 », « 02 »… */
export function Index({ n, dark = false }: { n: number; dark?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`font-mono text-xs tracking-[0.2em] ${dark ? "text-champagne" : "text-muted"}`}
    >
      {String(n).padStart(2, "0")}
    </span>
  );
}

export function DashList({ items, className = "" }: { items: string[]; className?: string }) {
  return (
    <ul className={`space-y-2.5 ${className}`}>
      {items.map((item) => (
        <li key={item} className="relative pl-5 leading-relaxed">
          <span aria-hidden="true" className="absolute top-[0.7em] left-0 h-px w-2.5 bg-champagne" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------------ */
/* Icônes                                                                     */
/* ------------------------------------------------------------------------ */

type IconProps = { className?: string };

export function ArrowIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path d="M2 8h11M9 4l4 4-4 4" />
    </svg>
  );
}

export function MenuIcon({ className = "size-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path d="M3 7h18M3 12h18M9 17h12" />
    </svg>
  );
}

export function CloseIcon({ className = "size-6" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function CheckIcon({ className = "size-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}
