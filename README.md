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
