'use strict';

/**
 * Appel à l'IA (workflow 07) pour proposer une catégorie aux opérations que QuickBooks n'a pas classées.
 * SDK officiel @anthropic-ai/sdk ; sans clé ANTHROPIC_API_KEY ou sans le SDK installé, l'IA est simplement absente.
 * Seuls le bénéficiaire, la description, le montant, la date et le plan comptable sont envoyés.
 */

const DEFAULT_MODEL = 'claude-opus-5-5';

const SYSTEM = `Tu aides une firme comptable québécoise (BVY) à classer des opérations que QuickBooks Online n'a pas su catégoriser.
Pour chaque opération, choisis dans le plan comptable fourni le compte qui convient le mieux.
Règles :
- Réponds uniquement avec un compte de la liste (son identifiant), ou "aucun" si aucun ne convient vraiment.
- confidence : ta confiance de 0 à 100. Sois prudent : sous 75 si le bénéficiaire ou la description laisse un doute réel (par exemple un magasin qui vend de tout).
- reason : une phrase courte en français, sans jargon, qui explique le choix.
- N'invente jamais de compte, de taxe ni de fait sur le client.`;

function createAi(env = process.env, { sdk = null } = {}) {
  const apiKey = env.ANTHROPIC_API_KEY || '';
  if (!apiKey) return null;
  let Anthropic = sdk;
  if (!Anthropic) {
    try { Anthropic = require('@anthropic-ai/sdk'); } catch {
      console.error('IA désactivée : le module @anthropic-ai/sdk est introuvable (npm ci --omit=dev dans le portail).');
      return null;
    }
  }
  const Client = Anthropic.default || Anthropic;
  const client = new Client({ apiKey, maxRetries: 2, timeout: 60_000 });
  const model = env.AI_MODEL || DEFAULT_MODEL;

  // lines : [{ ref, party, description, amount, date, kind }] ; accounts : [{ id, name, type }]
  async function classify(lines, accounts) {
    const ids = accounts.map((a) => String(a.id));
    const schema = {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ref: { type: 'string' },
              account_id: { type: 'string', enum: [...ids, 'aucun'] },
              confidence: { type: 'integer' },
              reason: { type: 'string' },
            },
            required: ['ref', 'account_id', 'confidence', 'reason'],
            additionalProperties: false,
          },
        },
      },
      required: ['results'],
      additionalProperties: false,
    };
    const prompt = `Plan comptable (identifiant — nom — type) :
${accounts.map((a) => `${a.id} — ${a.name} — ${a.type || ''}`).join('\n')}

Opérations à classer :
${lines.map((l) => `ref ${l.ref} : ${l.kind === 'Deposit' ? 'dépôt' : 'paiement'} de ${(l.amount / 100).toFixed(2)} $ le ${l.date || '?'} — bénéficiaire : ${l.party || 'inconnu'} — description : ${l.description || 'aucune'}`).join('\n')}`;
    const res = await client.messages.create({
      model,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: prompt }],
    });
    if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') throw new Error(`Réponse de l’IA incomplète (${res.stop_reason}).`);
    const text = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error('Réponse de l’IA illisible.'); }
    return { results: Array.isArray(parsed.results) ? parsed.results : [], usage: res.usage || {}, model: res.model || model };
  }

  return { model, classify };
}

module.exports = { createAi, SYSTEM };
