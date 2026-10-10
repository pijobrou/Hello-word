// Génère tokens.css à partir de tokens.json (seule source de vérité).
// Usage : node scripts/build-tokens.mjs          → écrit tokens.css
//         node scripts/build-tokens.mjs --check  → échoue si tokens.css n'est pas à jour
import fs from 'node:fs';
import path from 'node:path';
import { root, loadTokens, flatten } from './tokens-lib.mjs';

const tokens = loadTokens();
const list = flatten(tokens);
const lines = [
  '/* BVY design system — jetons CSS',
  '   FICHIER GÉNÉRÉ par scripts/build-tokens.mjs à partir de tokens.json. Ne pas modifier à la main. */',
  ':root{',
];
let group = '';
for (const t of list) {
  if (t.group !== group) { group = t.group; lines.push(`  /* ${group} */`); }
  const value = t.ref ? `var(${t.ref.cssVar})` : t.value;
  lines.push(`  ${t.cssVar}:${value};${t.description ? ` /* ${t.description.replace(/\*\//g, '')} */` : ''}`);
}
lines.push('}', '');
const css = lines.join('\n');
const out = path.join(root, 'tokens.css');
if (process.argv.includes('--check')) {
  const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (current !== css) { console.error('✘ tokens.css n’est pas à jour : lancer node scripts/build-tokens.mjs'); process.exit(1); }
  console.log(`✔ tokens.css à jour (${list.length} jetons)`);
} else {
  fs.writeFileSync(out, css);
  console.log(`✔ tokens.css écrit — ${list.length} jetons`);
}
