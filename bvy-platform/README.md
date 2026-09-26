# BVY Accounting & Tax Services — plateforme

Projet BVY organisé selon le cadre WAT (Workflows, Agents, Tools) décrit dans `CLAUDE.md`.

**Phase actuelle : 0 — site public.** `STATUS: WAITING_FOR_OWNER_APPROVAL`
Rien d'autre (portail, QuickBooks, IA) n'est construit avant l'approbation du site par la propriétaire ou le propriétaire.

| Dossier | Contenu |
|---|---|
| `apps/website/` | Site public : pages sources (`src/`), site compilé (`public/`), serveur Node.js sans dépendance (`server.js`), tests |
| `tools/deployment/` | Déploiement sur le VPS OVH — **commencer par `DEPLOIEMENT.md`** |
| `tools/website/` | Captures d'écran de revue, déclinaisons du logo |
| `workflows/` | Procédures (SOP) — `00_create_bvy_website.md` |
| `review/` | Dossier de revue : `REVIEW.md` + captures bureau et mobile |

## Voir le site sur votre ordinateur

```cmd
cd bvy-platform\apps\website
node server.js
```

Puis ouvrir http://localhost:3000 (Node.js 20.12 ou plus récent ; aucune installation `npm install` nécessaire).

## Modifier une page

1. Modifier le fichier dans `apps/website/src/pages/` (pas dans `public/`, qui est généré).
2. `node build.js` puis `npm test`.
3. Redéployer avec `tools\deployment\deploy.cmd`.
