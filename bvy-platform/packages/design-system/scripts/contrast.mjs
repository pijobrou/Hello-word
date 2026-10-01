// Vérifie le contraste WCAG 2.2 AA de chaque paire texte/fond déclarée dans tokens.json ($contrast.pairs).
// Seuils : text 4.5:1 · large 3:1 (≥ 24 px, ou ≥ 18,66 px gras) · ui 3:1 (contours, focus, graphiques).
// Les couleurs semi-transparentes sont composées sur leur fond (et le fond sur « over » s'il est transparent).
// Usage : node scripts/contrast.mjs [--md]   — code de sortie 1 si une paire échoue.
import { loadTokens, flatten, finder } from './tokens-lib.mjs';

const MIN = { text: 4.5, large: 3, ui: 3 };

function parse(c) {
  c = c.trim();
  let m = c.match(/^#([0-9a-f]{6})$/i);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: 1 };
  m = c.match(/^#([0-9a-f]{3})$/i);
  if (m) return { r: parseInt(m[1][0].repeat(2), 16), g: parseInt(m[1][1].repeat(2), 16), b: parseInt(m[1][2].repeat(2), 16), a: 1 };
  m = c.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  throw new Error(`Couleur non reconnue : ${c}`);
}
const over = (top, base) => ({ r: top.r * top.a + base.r * (1 - top.a), g: top.g * top.a + base.g * (1 - top.a), b: top.b * top.a + base.b * (1 - top.a), a: 1 });
const lum = ({ r, g, b }) => {
  const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

const tokens = loadTokens();
const find = finder(flatten(tokens));
const rows = [];
let failures = 0;
for (const p of tokens.$contrast.pairs) {
  if (!MIN[p.kind]) throw new Error(`kind inconnu : ${p.kind}`);
  let bg = parse(find(p.bg).value);
  if (bg.a < 1) {
    if (!p.over) throw new Error(`Fond transparent sans « over » : ${p.bg}`);
    bg = over(bg, parse(find(p.over).value));
  }
  const fg = over(parse(find(p.fg).value), bg);
  const r = ratio(fg, bg);
  const pass = r >= MIN[p.kind];
  // Une paire « forbidden » documente une combinaison interdite : elle est attendue sous le seuil.
  const ok = p.forbidden ? !pass : pass;
  if (!ok) failures++;
  rows.push({ ...p, fgHex: hex(fg), bgHex: hex(bg), r, ok });
}

if (process.argv.includes('--md')) {
  console.log('| Texte / élément | Fond | Couleurs | Ratio | Seuil | Résultat | Usage |');
  console.log('|---|---|---|---|---|---|---|');
  for (const x of rows) console.log(`| \`${x.fg}\` | \`${x.bg}\`${x.over ? ` sur \`${x.over}\`` : ''} | ${x.fgHex} / ${x.bgHex} | ${x.r.toFixed(2)}:1 | ${MIN[x.kind]}:1 (${x.kind}) | ${x.forbidden ? (x.ok ? 'Interdit (attendu)' : '**À REVOIR**') : x.ok ? 'OK' : '**ÉCHEC**'} | ${x.use} |`);
} else {
  for (const x of rows) console.log(`${x.ok ? (x.forbidden ? '⊘' : '✔') : '✘'} ${x.r.toFixed(2).padStart(6)}:1  ≥${MIN[x.kind]}  ${x.fg} sur ${x.bg}${x.over ? ` (sur ${x.over})` : ''}  ${x.fgHex}/${x.bgHex}  — ${x.use}`);
}
const minRow = rows.filter((x) => !x.forbidden).reduce((a, b) => (a.r / MIN[a.kind] < b.r / MIN[b.kind] ? a : b));
console.error(`\n${rows.filter((x) => !x.forbidden).length} paires autorisées vérifiées, ${rows.filter((x) => x.forbidden).length} combinaisons interdites documentées, ${failures} échec(s). Marge la plus faible : ${minRow.fg} sur ${minRow.bg} = ${minRow.r.toFixed(2)}:1 (seuil ${MIN[minRow.kind]}:1).`);
process.exit(failures ? 1 : 0);
