# 🚀 START HERE - VideoGen Platform

Bienvenue ! Ceci est votre plateforme de création vidéo complète. Voici comment démarrer.

---

## ⚡ 5 minutes pour lancer le projet

### Étape 1: Vérifier les prérequis
```bash
node --version        # v18+
docker --version      # Latest
git --version         # Latest
```

### Étape 2: Clone & Setup
```bash
cd /your/workspace
git clone <your-repo> video-platform
cd video-platform

# Copy env templates
cp .env.example .env.local
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env.local
```

### Étape 3: Lancer DB
```bash
docker-compose up -d    # Démarre PostgreSQL + Redis
npm run db:push         # Sync schema
```

### Étape 4: Install & Dev
```bash
npm install
npm run dev
```

**Frontend:** http://localhost:3000  
**Backend:** http://localhost:3001

---

## 📋 Avant de commencer: Checklist services

Vous avez besoin de ces services externes gratuits/payants:

### ✅ Priorité 1 (Obligatoire pour MVP)
- [ ] **Clerk** (Auth gratuit)
  - https://clerk.com → Sign up
  - Créer app
  - Copier clés dans .env
  
- [ ] **PostgreSQL** (gratuit avec Docker)
  - Déjà inclus dans `docker-compose.yml`

- [ ] **Redis** (gratuit avec Docker)
  - Déjà inclus dans `docker-compose.yml`

### ✅ Priorité 2 (Pour Phase 1)
- [ ] **Runway** (Génération vidéo - $0.05-0.30/vidéo)
  - https://runwayml.com
  - Créer compte
  - Générer API key

- [ ] **Supabase** (Storage - gratuit tier)
  - https://supabase.com
  - Créer projet
  - Copier URL et key

### ✅ Priorité 3 (Pour Phase 2)
- [ ] **ElevenLabs** (Text-to-speech - $0.30/1000 chars)
  - https://elevenlabs.io
  - Créer compte
  - Générer API key

- [ ] **Stripe** (Paiement - optionnel pour MVP)
  - https://stripe.com
  - Test mode keys

---

## 📂 Structure du projet

```
video-platform/
├── apps/
│   ├── web/                 # Frontend (Next.js)
│   │   └── app/
│   │       ├── page.tsx        # Home
│   │       └── (dashboard)/    # Routes protégées
│   │           ├── page.tsx       # Dashboard
│   │           └── editor/        # Éditeur vidéo
│   └── api/                 # Backend (Express)
│       └── src/
│           ├── routes/         # API endpoints
│           ├── services/       # Business logic
│           └── middleware/     # Auth, errors, etc
├── packages/
│   ├── db/                  # Prisma + Database
│   │   └── prisma/
│   │       └── schema.prisma   # Modèle de données
│   ├── config/              # Config partagée
│   └── types/               # TypeScript types
└── docs/
    ├── ARCHITECTURE.md      # Vue d'ensemble technique
    ├── API.md               # Documentation API
    ├── SETUP.md             # Instructions setup détaillé
    └── ROADMAP.md           # Phases de développement
```

---

## 🎯 Premières actions

### 1️⃣ Comprendre l'architecture (30 min)
Lire dans cet ordre:
1. `docs/ARCHITECTURE.md` - Vue d'ensemble
2. `docs/ROADMAP.md` - Phase par phase
3. `PHASE1.md` - Implémentation détaillée

### 2️⃣ Setup services externes (1h)
1. Créer compte Clerk
2. Créer compte Runway
3. Créer compte Supabase
4. Copier toutes les clés dans `.env.local`

### 3️⃣ Lancer le projet (15 min)
```bash
npm run dev
```

### 4️⃣ Tester l'auth (10 min)
- Aller à http://localhost:3000
- Cliquer "Sign In"
- Créer compte avec email
- Vérifier que vous êtes redirigé au dashboard

### 5️⃣ Créer un projet test
- Dashboard → "New Project"
- Donner un titre
- Vérifier que projet apparaît dans la liste

---

## 🔄 Workflows de développement

### ✏️ Ajouter une feature

1. **Créer branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Coder** (Frontend OU Backend)
   ```bash
   # Terminal 1: Frontend
   cd apps/web && npm run dev
   
   # Terminal 2: Backend
   cd apps/api && npm run dev
   ```

3. **Tester localement**
   - Vérifier que ça marche
   - Vérifier les types TypeScript
   - Vérifier que DB sync

4. **Commit & Push**
   ```bash
   git add .
   git commit -m "feat: Add new feature"
   git push origin feature/my-feature
   ```

5. **Créer PR**
   - Décrire ce que vous avez fait
   - Demander review

### 🐛 Debugging

**Frontend bug:**
```bash
# DevTools Next.js
http://localhost:3000/_next/static

# Logs du navigateur
F12 → Console
```

**Backend bug:**
```bash
# Logs du terminal
npm run dev --verbose

# Debug Express
DEBUG=* npm run dev
```

**Database bug:**
```bash
# Ouvrir Prisma Studio
npm run db:studio

# Voir et modifier les données directement
# URL: http://localhost:5555
```

---

## 📊 Progression Phase 1

Suivez cette checklist pour Phase 1:

- [ ] **Semaine 1-2:** Setup & Auth
  - [ ] Turborepo configuré
  - [ ] DB synced
  - [ ] Clerk intégré
  - [ ] Sign in/up fonctionnel

- [ ] **Semaine 3-4:** Dashboard
  - [ ] Listing projects
  - [ ] Créer/supprimer projets
  - [ ] UI dashboard complète

- [ ] **Semaine 5-6:** Éditeur simple
  - [ ] Ajouter clips
  - [ ] Preview clips
  - [ ] Configuration basique

- [ ] **Semaine 7-8:** Runway integration
  - [ ] BullMQ setup
  - [ ] Appel API Runway
  - [ ] Job queue fonctionnel
  - [ ] WebSocket updates

- [ ] **Semaine 9-10:** Export
  - [ ] API export
  - [ ] FFmpeg compilation
  - [ ] Upload Supabase
  - [ ] Download link

**À la fin:** Vous avez un **MVP vendable** ! 🎉

---

## 📚 Documentation utile

### Stack-specific
- **Next.js**: https://nextjs.org/docs
- **Express**: https://expressjs.com/
- **Prisma**: https://www.prisma.io/docs/
- **TypeScript**: https://www.typescriptlang.org/docs/

### Services externes
- **Clerk**: https://clerk.com/docs
- **Runway**: https://docs.runwayml.com
- **Supabase**: https://supabase.com/docs
- **Stripe**: https://stripe.com/docs/stripe-cli

### Outils
- **Socket.io**: https://socket.io/docs/
- **BullMQ**: https://docs.bullmq.io/
- **FFmpeg**: https://ffmpeg.org/documentation.html

---

## 🆘 Problèmes courants

### "Port 3000 déjà utilisé"
```bash
lsof -i :3000
kill -9 <PID>
```

### "Erreur PostgreSQL"
```bash
docker-compose logs postgres
docker-compose restart postgres
```

### "Module not found"
```bash
npm install
npm run build
rm -rf node_modules/.turbo
npm run dev
```

### "Env vars not loading"
```bash
# Vérifier .env.local existe
ls -la .env.local

# Vérifier contenu
cat .env.local

# Redémarrer dev server
npm run dev
```

---

## 🎓 Learning Path

**Si vous êtes nouveau au stack:**

1. **JavaScript/TypeScript basics** (2h)
   - Variables, functions, async/await
   - https://typescript-handbook.vercel.app/

2. **React fundamentals** (4h)
   - Components, hooks, state
   - https://react.dev/learn

3. **Next.js basics** (2h)
   - Pages, routing, API routes
   - https://nextjs.org/learn

4. **Express.js basics** (2h)
   - Routing, middleware, responses
   - https://expressjs.com/starter/basic-routing.html

5. **PostgreSQL + Prisma** (3h)
   - Tables, relations, queries
   - https://www.prisma.io/docs/getting-started

6. **Votre première feature** (4h)
   - Build end-to-end: Frontend → Backend → DB

---

## ✨ Quick wins

Ces tasks peuvent être faites en 1-2 heures:

- [ ] Ajouter favicon
- [ ] Customizer couleurs
- [ ] Ajouter logo
- [ ] Créer landing page
- [ ] Écrire README détaillé
- [ ] Ajouter validation form
- [ ] Ajouter loading states
- [ ] Ajouter error boundaries

---

## 🚀 Prochaines étapes

**Vous êtes prêt !** 

1. Lire `docs/ARCHITECTURE.md` (30 min)
2. Setup services externes (1h)
3. Lancer le projet (`npm run dev`)
4. Commencer Phase 1 avec `PHASE1.md`

---

## 💬 Questions?

Ce projet est **100% documenté**:
- `docs/` - Documentation technique
- `PHASE1.md` - Implémentation étape par étape
- Code comments - Expliquent la logique

**Bonne chance ! Vous allez créer quelque chose d'incroyable.** 🚀
