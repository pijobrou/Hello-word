# 💎 Serveur « Voix IA Premium » (Cloudflare Workers)

Ce serveur vend la voix IA à vos clients : il vérifie la licence et le quota, puis fabrique la voix
avec **votre** clé OpenAI. Il remplace n8n pour l'usage commercial. La licence n8n (Sustainable Use)
n'autorise pas son usage comme service payant pour des tiers.

| Adresse | Rôle |
|---|---|
| `GET /merci?session_id=…` | page affichée après le paiement Stripe : donne la clé de licence `TA-XXXX-XXXX-XXXX-XXXX` |
| `GET /licence` | offre, statut de l'abonnement, minutes utilisées ce mois-ci, appareil |
| `POST /dub` | voix IA (Premium uniquement), avec quota mensuel |
| `POST /activer` | `{ "transfert": true }` : déplace la licence sur l'appareil qui fait la demande |

**Une licence = un seul appareil (navigateur).** L'extension envoie un identifiant tiré au hasard à
l'installation (en-tête `X-Device`). La première utilisation attache la licence à cet appareil, et tout
autre appareil est refusé. Un transfert est possible au plus une fois tous les 30 jours. Comme la voix
Premium est fabriquée ici, une clé copiée ne sert à rien ailleurs. La licence « À vie » (clé du client)
est seulement vérifiée par l'extension, donc elle est moins protégée.

## Mise en ligne (15 minutes)

1. Créez un compte gratuit sur cloudflare.com, puis installez Node.js.
2. Dans ce dossier :
   ```bash
   npx wrangler login
   npx wrangler kv namespace create LICENSES     # recopiez l'« id » dans wrangler.toml
   npx wrangler secret put OPENAI_API_KEY        # votre clé OpenAI (sk-…)
   npx wrangler secret put STRIPE_SECRET_KEY     # clé Stripe restreinte (lecture Checkout Sessions + Subscriptions)
   npx wrangler secret put LICENSE_SECRET        # une longue phrase secrète inventée (ne la changez plus ensuite)
   npx wrangler deploy
   ```
3. Notez l'adresse affichée (`https://traducteur-audio.<vous>.workers.dev`).
4. Dans Stripe, modifiez les **deux liens de paiement** → « Après le paiement » → **Rediriger vers**
   `https://traducteur-audio.<vous>.workers.dev/merci?session_id={CHECKOUT_SESSION_ID}`.
5. Dans l'extension : Réglages → 💎 Premium → **Adresse du serveur Premium**.

Pour passer en réel : refaites les produits et liens de paiement en mode **live** dans Stripe, mettez
leurs identifiants de prix dans `wrangler.toml` (`PRICE_PREMIUM`, `PRICE_LIFETIME`) et une clé Stripe
**live**.

## Coûts
Cloudflare Workers et KV ont une offre gratuite qui suffit pour démarrer. La voix OpenAI coûte
≈ 0,006 $/min selon OpenAI, à vérifier sur leur page de prix. 5 h (300 min) par client et par mois
reviennent donc à environ 1,80 à 4,50 $ si le client utilise tout son quota.

## Tests
Testé avec Miniflare (simulateur officiel Cloudflare), Stripe et OpenAI simulés : clé de licence
stable, refus sans clé, quota, licence « À vie » refusée sur `/dub`, verrouillage à un appareil et
transfert limité.
