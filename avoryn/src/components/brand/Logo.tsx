import { SYMBOL, WORDMARK } from "./geometry";

type MarkProps = {
  className?: string;
  /** Texte alternatif ; omis = décoratif (aria-hidden). */
  title?: string;
};

function a11y(title?: string) {
  return title ? { role: "img" as const, "aria-label": title } : { "aria-hidden": true as const };
}

export function BrandSymbol({ className, title }: MarkProps) {
  return (
    <svg viewBox={SYMBOL.viewBox} className={className} {...a11y(title)} focusable="false">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={SYMBOL.strokeWidth}
        strokeLinejoin="miter"
        strokeMiterlimit={10}
      >
        <polygon points={SYMBOL.frame} />
        <path d={SYMBOL.core} />
      </g>
    </svg>
  );
}

export function Wordmark({ className, title }: MarkProps) {
  return (
    <svg viewBox={WORDMARK.viewBox} className={className} {...a11y(title)} focusable="false">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={WORDMARK.strokeWidth}
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeMiterlimit={10}
      >
        {WORDMARK.letters.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

type LogoProps = {
  className?: string;
  orientation?: "horizontal" | "vertical";
  /** Couleur du symbole (classe Tailwind), par défaut héritée. */
  symbolClassName?: string;
  wordClassName?: string;
  title?: string;
};

/** Logo complet : symbole + logotype. Les couleurs suivent `currentColor`. */
export function Logo({
  className = "",
  orientation = "horizontal",
  symbolClassName = "",
  wordClassName = "",
  title = "AVORYN",
}: LogoProps) {
  const vertical = orientation === "vertical";
  return (
    <span
      role="img"
      aria-label={title}
      className={`inline-flex ${vertical ? "flex-col items-center gap-[0.55em]" : "items-center gap-[0.6em]"} ${className}`}
    >
      <BrandSymbol className={`${vertical ? "h-[1.7em]" : "h-[1.45em]"} w-auto shrink-0 ${symbolClassName}`} />
      <Wordmark className={`h-[1em] w-auto ${wordClassName}`} />
    </span>
  );
}
