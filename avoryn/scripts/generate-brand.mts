/**
 * Génère les déclinaisons SVG du logo AVORYN à partir de la géométrie
 * partagée (src/components/brand/geometry.ts).
 * Usage : npm run brand
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BRAND_COLORS, SYMBOL, WORDMARK } from "../src/components/brand/geometry.ts";

const outDir = join(import.meta.dirname, "..", "public", "brand");
mkdirSync(outDir, { recursive: true });

type Colors = { symbol: string; word: string; background?: string };

function symbolSvg(x: number, y: number, scale: number, color: string): string {
  return `<svg x="${x}" y="${y}" width="${SYMBOL.width * scale}" height="${SYMBOL.height * scale}" viewBox="${SYMBOL.viewBox}">
    <g fill="none" stroke="${color}" stroke-width="${SYMBOL.strokeWidth}" stroke-linejoin="miter" stroke-miterlimit="10">
      <polygon points="${SYMBOL.frame}"/>
      <path d="${SYMBOL.core}"/>
    </g>
  </svg>`;
}

function wordmarkSvg(x: number, y: number, scale: number, color: string): string {
  return `<svg x="${x}" y="${y}" width="${WORDMARK.width * scale}" height="${WORDMARK.height * scale}" viewBox="${WORDMARK.viewBox}">
    <g fill="none" stroke="${color}" stroke-width="${WORDMARK.strokeWidth}" stroke-linecap="square" stroke-linejoin="miter" stroke-miterlimit="10">
      ${WORDMARK.letters.map((d) => `<path d="${d}"/>`).join("\n      ")}
    </g>
  </svg>`;
}

function documentSvg(width: number, height: number, body: string, colors: Colors, title: string): string {
  const bg = colors.background ? `<rect width="100%" height="100%" fill="${colors.background}"/>\n  ` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title">
  <title id="title">${title}</title>
  ${bg}${body}
</svg>
`;
}

function horizontal(colors: Colors, pad: number): { w: number; h: number; body: string } {
  const gap = 26;
  const w = SYMBOL.width + gap + WORDMARK.width + pad * 2;
  const h = SYMBOL.height + pad * 2;
  const body = [
    symbolSvg(pad, pad, 1, colors.symbol),
    wordmarkSvg(pad + SYMBOL.width + gap, pad + (SYMBOL.height - WORDMARK.height) / 2, 1, colors.word),
  ].join("\n  ");
  return { w, h, body };
}

function vertical(colors: Colors, pad: number): { w: number; h: number; body: string } {
  const scale = 1.25;
  const symW = SYMBOL.width * scale;
  const symH = SYMBOL.height * scale;
  const gap = 26;
  const w = WORDMARK.width + pad * 2;
  const h = symH + gap + WORDMARK.height + pad * 2;
  const body = [
    symbolSvg(pad + (WORDMARK.width - symW) / 2, pad, scale, colors.symbol),
    wordmarkSvg(pad, pad + symH + gap, 1, colors.word),
  ].join("\n  ");
  return { w, h, body };
}

const { night, champagne, white } = BRAND_COLORS;
const title = "AVORYN";

const variants: Array<[string, (c: Colors, pad: number) => { w: number; h: number; body: string }, Colors, number]> = [
  ["avoryn-horizontal-gold-on-night", horizontal, { symbol: champagne, word: champagne, background: night }, 48],
  ["avoryn-horizontal-night-on-white", horizontal, { symbol: night, word: night, background: white }, 48],
  ["avoryn-horizontal-gold-night", horizontal, { symbol: champagne, word: night }, 4],
  ["avoryn-horizontal-mono-black", horizontal, { symbol: "#000000", word: "#000000" }, 4],
  ["avoryn-horizontal-mono-white", horizontal, { symbol: white, word: white }, 4],
  ["avoryn-vertical-gold-on-night", vertical, { symbol: champagne, word: champagne, background: night }, 56],
  ["avoryn-vertical-night-on-white", vertical, { symbol: night, word: night, background: white }, 56],
  ["avoryn-vertical-mono-black", vertical, { symbol: "#000000", word: "#000000" }, 4],
];

for (const [name, layout, colors, pad] of variants) {
  const { w, h, body } = layout(colors, pad);
  writeFileSync(join(outDir, `${name}.svg`), documentSvg(w, h, body, colors, title));
}

// Symbole seul
for (const [name, color] of [
  ["avoryn-symbol-gold", champagne],
  ["avoryn-symbol-night", night],
  ["avoryn-symbol-mono-black", "#000000"],
] as const) {
  writeFileSync(
    join(outDir, `${name}.svg`),
    documentSvg(SYMBOL.width, SYMBOL.height, symbolSvg(0, 0, 1, color), { symbol: color, word: color }, title),
  );
}

// Favicon : symbole or sur pastille bleu nuit
const favicon = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-labelledby="title">
  <title id="title">AVORYN</title>
  <rect width="64" height="64" rx="14" fill="${night}"/>
  ${symbolSvg(7, 16, 0.46, champagne).replace(`stroke-width="${SYMBOL.strokeWidth}"`, 'stroke-width="6"')}
</svg>
`;
writeFileSync(join(outDir, "avoryn-favicon.svg"), favicon);
writeFileSync(join(import.meta.dirname, "..", "src", "app", "icon.svg"), favicon);

console.log(`Logos générés dans ${outDir}`);
