# 🏗️ Architecture - VideoGen Platform

## Vue d'ensemble

VideoGen est une **plateforme de création vidéo full-stack** organisée en 3 couches :

```
┌─────────────────────────────────────────────────┐
│         Frontend (Next.js 14)                    │
│  - Dashboard, Éditeur vidéo, Templates          │
├─────────────────────────────────────────────────┤
│         API Gateway (Express + Socket.io)        │
│  - REST endpoints, Real-time updates             │
├─────────────────────────────────────────────────┤
│         Services (PostgreSQL + Redis)            │
│  - Job Queue (BullMQ), Storage (Supabase)       │
│  - External APIs (Runway, ElevenLabs, D-ID)     │
└─────────────────────────────────────────────────┘
```

## 📁 Organisation Monorepo (Turborepo)

```
video-platform/
├── apps/
│   ├── web/              # Next.js 14 frontend
│   ├── api/              # Express backend API
│   └── worker/           # BullMQ job processor (Phase 2+)
├── packages/
│   ├── db/               # Prisma schema + migrations
│   ├── config/           # Config partagée
│   └── types/            # TypeScript types partagés
└── docs/                 # Documentation
```

## 🔄 Flux de données

### 1. Création d'un projet

```
User créé un nouveau projet
    ↓
Frontend POST /api/projects
    ↓
Backend crée Project record (BD)
    ↓
Frontend reçoit project.id
    ↓
User sélectionne un template ou commence vide
```

### 2. Génération vidéo

```
User configure clip (texte + style)
    ↓
Frontend POST /api/clips avec prompt
    ↓
Backend crée Clip (status: PENDING)
    ↓
Backend enqueue GenerateVideo job (BullMQ)
    ↓
Worker traite le job
    ↓
Worker appelle Runway API
    ↓
Vidéo générée → Supabase Storage
    ↓
WebSocket: clip.status = READY
    ↓
Frontend affiche vidéo dans l'éditeur
```

### 3. Export final

```
User clique "Export"
    ↓
Frontend POST /api/exports (format, résolution)
    ↓
Backend crée Export (status: QUEUED)
    ↓
Backend enqueue ExportProject job
    ↓
Worker compile tous les clips
    ↓
FFmpeg combine vidéos + audio
    ↓
Fichier → Supabase Storage
    ↓
WebSocket: export.status = READY
    ↓
Frontend affiche lien de téléchargement
```

## 🗄️ Modèle de données

### Entités principales

**User**
- Gère les projets, templates, exports
- Subscription tier (FREE, PRO, STUDIO)
- Lié à Clerk pour l'auth

**Project**
- Contient plusieurs Clips
- Statut : DRAFT → IN_PROGRESS → COMPLETED

**Clip**
- Contenu unique (vidéo, texte, audio)
- Type : AI_GENERATED, VIDEO, IMAGE, TEXT, AUDIO, AVATAR
- Générés par IA ou uploadés

**Template**
- Réutilisable
- Contient config JSON (durée, transitions, musique)

**Export**
- Résultat final d'un Project
- Format + résolution
- Stocké dans Supabase

**Job** (background)
- Générations vidéo, exports, traitements audio
- Queue par BullMQ + Redis

## 🔐 Authentification & Autorisation

**Auth Flow:**
1. User se connecte via Clerk (Google, GitHub, Email)
2. Clerk émet JWT (stocké dans cookie sécurisé)
3. Frontend envoie JWT dans Authorization header
4. Backend valide via Clerk webhook

**Autorisation:**
- Chaque requête vérifie: `req.user.id === resource.userId`
- Partage public : token aléatoire + expirationt

## 🚀 Services externes

| Service | Usage | API | Coût |
|---------|-------|-----|------|
| **Runway** | Génération vidéo à partir de texte | REST | $0.05-0.30/min vidéo |
| **ElevenLabs** | Text-to-speech haute qualité | REST + WebSocket | $0.30/1000 chars |
| **D-ID** | Avatars parlants | REST | $0.10/min vidéo |
| **Stripe** | Paiement + subscription | REST | 2.9% + $0.30/tx |
| **Supabase** | Storage + CDN | S3-compatible | $5-100/mois |

## 📊 Base de données (PostgreSQL)

Schema complet dans `packages/db/prisma/schema.prisma`

**Indexes clés :**
- `User.email` (unique)
- `Project.userId` + status
- `Clip.projectId` + status
- `Export.userId` + status
- `Job.type` + status

## 🔌 API REST

**Endpoints Phase 1 MVP:**

```
POST   /api/auth/signin
POST   /api/auth/signout

GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id

GET    /api/projects/:projectId/clips
POST   /api/projects/:projectId/clips
DELETE /api/clips/:id
PATCH  /api/clips/:id

GET    /api/templates
GET    /api/templates/:id

POST   /api/exports
GET    /api/exports/:id
DELETE /api/exports/:id

GET    /api/user/profile
PATCH  /api/user/profile
```

## 🔌 WebSocket Events

Real-time updates via Socket.io :

```javascript
// Listening
socket.on('clip:ready', (clipId) => {})
socket.on('export:progress', (progress) => {})
socket.on('export:completed', (exportId) => {})
socket.on('error:generation', (error) => {})

// Emitting (client→server)
socket.emit('preview:request', { clipId })
```

## 📈 Performances & Scaling

**Phase 1 MVP:**
- PostgreSQL (single instance)
- Redis (single instance)
- Storage: Supabase
- Workers: 1-2 instances

**Scaling (Phase 3+):**
- PostgreSQL avec read replicas
- Redis Cluster
- Worker pool elastique (Kubernetes/ECS)
- CDN Supabase Storage

## 🔒 Sécurité

- **Auth**: JWT + Clerk validation
- **CORS**: Domaines whitelist
- **Rate limiting**: 100 req/min par user
- **Validation**: Joi/Zod sur tous les inputs
- **Uploads**: Virus scan + type validation
- **Secrets**: Variables d'env sécurisées (Railway/Vercel)

## 🧪 Testing

**Phase 1:** Tests unitaires (Jest)
**Phase 2:** Tests E2E (Playwright) 
**Phase 3:** Load testing (k6)

## 📦 Déploiement

**Frontend:** Vercel (auto-deploy main)
**Backend:** Railway (auto-deploy main)
**Database:** Railway Postgres (managed)
**Storage:** Supabase

Voir `docs/SETUP.md` pour détails.
