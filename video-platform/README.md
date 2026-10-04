# 🎬 VideoGen Platform

Plateforme complète de création vidéo par IA - Marketing, réseaux sociaux, contenu personnalisé.

## 📋 Stack Technique

- **Frontend**: Next.js 14 + React 18 + TypeScript
- **Backend**: Node.js/Express + PostgreSQL + Prisma
- **Services IA**: Runway ML, ElevenLabs, D-ID
- **Auth**: Clerk
- **Storage**: Supabase Storage
- **Payment**: Stripe
- **Queues**: BullMQ
- **Real-time**: Socket.io

## 🚀 Démarrage rapide

```bash
# Setup frontend
cd apps/web
npm install
npm run dev

# Setup backend
cd apps/api
npm install
npm run dev

# Setup database
npm run db:push
```

## 📁 Structure du projet

```
video-platform/
├── apps/
│   ├── web/                 # Next.js frontend
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── public/
│   ├── api/                 # Node.js backend
│   │   ├── src/
│   │   ├── routes/
│   │   └── services/
│   └── worker/              # Job queue processor
├── packages/
│   ├── db/                  # Prisma schema
│   ├── config/              # Shared config
│   └── types/               # TypeScript types
├── docs/                    # Documentation
└── docker-compose.yml       # Local dev environment
```

## 🔄 Phases de développement

**Phase 1 (MVP - 6-8 sem)**: Auth, Templates simples, Génération Runway, Export
**Phase 2 (8 sem)**: Wizard avancé, TTS, Partage, Dashboard
**Phase 3 (10 sem)**: Éditeur timeline complète, Multi-clips, Transitions
**Phase 4 (6 sem)**: Optimisations, Presets résolutions, Intégrations réseaux

## 📚 Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [API Spec](./docs/API.md)
- [Database Schema](./docs/DATABASE.md)
- [Setup Dev](./docs/SETUP.md)

## 🔐 Variables d'environnement

Voir `.env.example` pour tous les secrets requis.

## 📞 Support

Pour des questions : consultez la [documentation complète](./docs)
