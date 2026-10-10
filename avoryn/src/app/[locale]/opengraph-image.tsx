import { ImageResponse } from "next/og";
import { BRAND_COLORS, SYMBOL, WORDMARK } from "@/components/brand/geometry";
import { getDictionary } from "@/content";
import { isLocale, locales } from "@/lib/i18n";

export const alt = "AVORYN";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const dict = getDictionary(isLocale(locale) ? locale : "fr");
  const { night, champagne } = BRAND_COLORS;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: night,
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <svg width={162} height={102} viewBox={SYMBOL.viewBox}>
            <g fill="none" stroke={champagne} strokeWidth={SYMBOL.strokeWidth} strokeLinejoin="miter" strokeMiterlimit={10}>
              <polygon points={SYMBOL.frame} />
              <path d={SYMBOL.core} />
            </g>
          </svg>
          <svg width={385} height={67} viewBox={WORDMARK.viewBox}>
            <g fill="none" stroke={champagne} strokeWidth={WORDMARK.strokeWidth} strokeLinecap="square" strokeLinejoin="miter" strokeMiterlimit={10}>
              {WORDMARK.letters.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
          </svg>
        </div>
        <div style={{ display: "flex", marginTop: 56, width: 80, height: 2, background: champagne }} />
        <div style={{ display: "flex", marginTop: 32, fontSize: 52, fontWeight: 600, letterSpacing: -1 }}>
          {dict.meta.slogan}
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 28, color: "rgba(255,255,255,0.72)" }}>
          {dict.meta.positioning}
        </div>
      </div>
    ),
    size,
  );
}
