// Lecture de tokens.json et résolution des références {groupe.nom}. Sans dépendance.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadTokens(file = path.join(root, 'tokens.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Liste ordonnée des jetons : { group, name, cssVar, raw, value, description } */
export function flatten(tokens) {
  const list = [];
  const byPath = new Map();
  for (const [group, entries] of Object.entries(tokens)) {
    if (group.startsWith('$')) continue;
    const prefix = entries.$prefix ?? `${group}-`;
    for (const [name, def] of Object.entries(entries)) {
      if (name.startsWith('$')) continue;
      if (!def || typeof def !== 'object' || !('$value' in def)) throw new Error(`Jeton invalide : ${group}.${name}`);
      const t = { group, name, cssVar: `--bvy-${prefix}${name}`, raw: String(def.$value), description: def.$description || '' };
      if (list.some((o) => o.cssVar === t.cssVar)) throw new Error(`Nom CSS en double : ${t.cssVar}`);
      list.push(t);
      byPath.set(`${group}.${name}`, t);
    }
  }
  const resolve = (t, seen = []) => {
    const m = t.raw.match(/^\{([\w-]+\.[\w-]+)\}$/);
    if (!m) return t.raw;
    const target = byPath.get(m[1]);
    if (!target) throw new Error(`Référence introuvable : ${t.group}.${t.name} → ${m[1]}`);
    if (seen.includes(m[1])) throw new Error(`Référence circulaire : ${[...seen, m[1]].join(' → ')}`);
    return resolve(target, [...seen, m[1]]);
  };
  for (const t of list) {
    t.value = resolve(t);
    const m = t.raw.match(/^\{([\w-]+\.[\w-]+)\}$/);
    t.ref = m ? byPath.get(m[1]) : null;
  }
  return list;
}

/** Retrouve un jeton par son nom (« text-muted ») ou son chemin (« role.text-muted »). */
export function finder(list) {
  return (key) => {
    const hit = key.includes('.') ? list.find((t) => `${t.group}.${t.name}` === key)
      : list.find((t) => t.group === 'role' && t.name === key) || list.find((t) => t.name === key);
    if (!hit) throw new Error(`Jeton inconnu : ${key}`);
    return hit;
  };
}
