# Hello-word
Serveur SEP24

Hello i m here to learn

## Compétence installée : Marketing Pro

Ce dépôt embarque une compétence (Agent Skill) : **Marketing Pro**, dans
`.claude/skills/marketing-pro/`.

| | |
|---|---|
| **Nom de la compétence** | `marketing-pro` |
| **Commande Claude Code** | `/marketing-pro [votre demande]` |
| **Déclenchement automatique** | dès qu'une demande marketing est formulée (stratégie, marque, campagne, contenu, SEO/AEO, reporting, conformité) |
| **Autres agents** | `AGENTS.md` à la racine (Codex, Cursor, Copilot CLI, Antigravity, Gemini CLI…) |

### Ce qu'elle contient

- la **méthodologie en 12 parties** (intake Stone vs Opinion → recherche → Quatre Documents
  Cœurs → validation client → Growth Plan + planning annuel → déclinaison par canal) ;
- le **catalogue de 163 capacités** marketing par famille, avec leur niveau de profondeur, les
  phrases de déclenchement et les contrôles qualité à passer ;
- les **24 rôles spécialistes** (stratégie, contenu, SEO, CRO, analytics, média, PR, conformité…) ;
- les **portes qualité** avant publication (sourcing des affirmations, distance de voix ≤ 0,15,
  garde-fous « humanize », approbation typée avant tout envoi réel) ;
- la **conformité 16 juridictions** — RGPD, CCPA/CPRA, DPDPA, LGPD… — et l'**AI Act européen
  article 50** / C2PA, plus les mécaniques de canaux 2026 (LinkedIn, e-mail, TikTok, Meta,
  WhatsApp, AEO/GEO sur 6 surfaces).

### Ce qu'elle ne contient pas

Les 93 scripts Python et les connecteurs du plugin d'origine ne sont **pas** embarqués : 108 des
163 capacités s'appuient en amont sur un script. Ici le travail est fait analytiquement, méthode
et limites annoncées. Pour la couche exécutable (signature C2PA, appels d'API réels, tests
statistiques), installez le plugin d'origine :

```
/plugin marketplace add indranilbanerjee/neels-plugins
/plugin install digital-marketing-pro@neels-plugins
```

### Démarrer

```
/marketing-pro set up a new brand for <nom du client>
/marketing-pro run the full engagement
/marketing-pro audit our SEO and AI-search visibility
/marketing-pro check this draft before we publish
```

Distillé de Digital Marketing Pro v3.31.1 (MIT, © Indranil Banerjee —
<https://github.com/indranilbanerjee/digital-marketing-pro>).

## Compétences installées : Firecrawl (recherche web)

Deux compétences Firecrawl ([firecrawl/skills](https://github.com/firecrawl/skills)) sont dans
`.claude/skills/` :

| Compétence | Commande | Pour |
|---|---|---|
| `firecrawl-search` | `/firecrawl-search <recherche>` | chercher sur le web (articles, sources, actualités), avec le contenu des pages si besoin |
| `firecrawl-build-search` | automatique | intégrer l'API `/search` de Firecrawl dans une application |

Le serveur MCP Firecrawl est déclaré dans `.mcp.json`. **La clé n'est pas dans le dépôt** : Claude
Code la lit dans la variable d'environnement `FIRECRAWL_API_KEY`.

```bash
# macOS / Linux (à mettre dans ~/.bashrc ou ~/.zshrc pour la garder)
export FIRECRAWL_API_KEY="fc-votre-cle"
# Windows (PowerShell)
setx FIRECRAWL_API_KEY "fc-votre-cle"
```

Puis relancez Claude Code dans ce dossier et acceptez le serveur `firecrawl-mcp` quand il le
demande. Pour la ligne de commande : `npm install -g firecrawl-cli`. Les résultats de recherche
sont enregistrés dans `.firecrawl/`, que Git ignore.

## Extension Chrome : Traducteur Audio EN → FR

Dans `traducteur-audio/` : traduit en voix française l'anglais d'un onglet (vidéo, live, appel),
des sous-titres ou du micro. Installation et mode d'emploi : `traducteur-audio/README.md`.
