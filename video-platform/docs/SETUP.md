# 🚀 Setup - Environnement de développement

## Prérequis

- **Node.js** 18+ (https://nodejs.org/)
- **Docker** (https://www.docker.com/) - optionnel, pour DB/Redis local
- **PostgreSQL** (si pas Docker)
- **Redis** (si pas Docker)
- **Git**

## ⚡ Quick Start (Docker)

```bash
# 1. Clone le repo
git clone <your-repo>
cd video-platform

# 2. Setup env files
cp .env.example .env.local
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env.local

# 3. Start services (PostgreSQL + Redis)
docker-compose up -d

# 4. Install dependencies
npm install

# 5. Setup database
npm run db:push

# 6. Start dev servers
npm run dev
```

Frontend: http://localhost:3000
Backend: http://localhost:3001
DB Studio: http://localhost:5555

## 📋 Configuration détaillée

### 1. Variables d'environnement

**`.env.local` (racine)**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NODE_ENV=development
```

**`apps/web/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key
```

**`apps/api/.env.local`**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/videogen_dev
REDIS_URL=redis://localhost:6379
CLERK_SECRET_KEY=your_key
STRIPE_SECRET_KEY=sk_test_...
RUNWAY_API_KEY=your_key
ELEVENLABS_API_KEY=your_key
```

### 2. Base de données

**Créer la BD:**
```bash
npm run db:push    # Sync schema avec DB
npm run db:migrate # Créer une nouvelle migration
npm run db:studio  # Ouvrir Prisma Studio (http://localhost:5555)
```

**Seed initial (optionnel):**
```bash
npm run db:seed    # Populate templates + samples
```

### 3. Services externes

#### Clerk (Authentification)
1. Créer compte: https://clerk.com
2. Créer application
3. Copier CLERK_PUBLISHABLE_KEY et CLERK_SECRET_KEY
4. Ajouter `http://localhost:3000` en Allowed redirect URIs
5. Ajouter webhook: `http://localhost:3001/webhooks/clerk`

#### Stripe (Paiement - optionnel pour MVP)
1. Créer compte: https://stripe.com
2. Aller à "API keys"
3. Copier sk_test_* et pk_test_*
4. Créer 3 products: FREE, PRO, STUDIO
5. Copier les product IDs

#### Runway ML (Génération vidéo)
1. S'inscrire: https://runwayml.com
2. Créer API key
3. Copier RUNWAY_API_KEY

#### ElevenLabs (Text-to-speech)
1. S'inscrire: https://elevenlabs.io
2. Copier API key
3. Choisir un voice_id

#### Supabase (Storage)
1. Créer projet: https://supabase.com
2. Copier SUPABASE_URL et SERVICE_KEY
3. Créer bucket "videos" et "avatars"

### 4. Lancer les serveurs

**Terminal 1 - Frontend:**
```bash
cd apps/web
npm install
npm run dev
# http://localhost:3000
```

**Terminal 2 - Backend:**
```bash
cd apps/api
npm install
npm run dev
# http://localhost:3001
```

**Terminal 3 - Worker (optionnel, Phase 2+):**
```bash
cd apps/worker
npm install
npm run dev
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests (Playwright)
npm run test:e2e

# Type checking
npm run type-check

# Linting
npm run lint
```

## 🐛 Dépannage

**Erreur: "Cannot find module"**
```bash
npm install
rm -rf node_modules/.turbo
npm run build
```

**Port déjà utilisé**
```bash
# Tuer le process
lsof -i :3000
kill -9 <PID>
```

**Erreur PostgreSQL connection**
```bash
# Vérifier Docker
docker-compose logs postgres

# Restart
docker-compose restart postgres
```

**Erreur Prisma migration**
```bash
npm run db:push --force  # DANGER: Réinitialise BD
```

## 📚 Ressources

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs/)
- [Express Docs](https://expressjs.com/)
- [Clerk Docs](https://clerk.com/docs)
- [Runway Docs](https://docs.runwayml.com)
- [Socket.io Docs](https://socket.io/docs/)

## 🚀 Déploiement (production)

Voir `docs/DEPLOYMENT.md`
