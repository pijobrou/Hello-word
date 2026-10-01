# 🗺️ Roadmap - VideoGen Platform

## Timeline estimée: 6-9 mois (dev solo)

---

## 📍 Phase 1: MVP - Fondations (6-8 semaines)

**Objectif:** Plateforme fonctionnelle pour créer et exporter des vidéos simples

### Semaines 1-2: Setup & Auth
- ✅ Setup Turborepo, Next.js, Express
- ✅ Base de données PostgreSQL
- ✅ Authentification Clerk
- ✅ UI framework (ShadcnUI + Tailwind)
- ✅ Webhook Clerk → Backend

### Semaines 3-4: Dashboard & Projects
- ✅ Listing des projets
- ✅ Créer/supprimer projets
- ✅ Layout principal (sidebar, navbar)
- ✅ Routing protégé

### Semaines 5-6: Éditeur simple
- ✅ Ajouter/supprimer clips
- ✅ Preview simple
- ✅ Configuration basique du clip

### Semaines 7-8: Intégration Runway
- ✅ Job queue (BullMQ)
- ✅ API Runway (text-to-video)
- ✅ Statut tracking (PENDING → PROCESSING → READY)
- ✅ WebSocket pour updates real-time

### Semaines 9-10: Export
- ✅ FFmpeg.wasm pour assemblage côté client (optionnel)
- ✅ Export simple (MP4, 720p)
- ✅ Download via Supabase Storage
- ✅ Quota FREE tier (5 exports/mois)

**Livrable Phase 1:**
- Plateforme fonctionnelle
- 1-2 services IA actifs (Runway)
- Authentification complète
- Dashboard basique
- Exportable

**Effort estimé:** 50-60 jours

---

## 📍 Phase 2: Templates & TTS (6-8 semaines)

**Objectif:** Templates prédéfinis + Voix IA

### Semaines 1-2: Templates
- ✅ Créer templates en admin panel
- ✅ Catégories (MARKETING, SOCIAL, etc)
- ✅ "Créer depuis template"
- ✅ Galerie de templates

### Semaines 3-4: Text-to-Speech
- ✅ Intégration ElevenLabs
- ✅ UI pour ajouter audio narration
- ✅ Sync audio + vidéo
- ✅ Sélection de voix

### Semaines 5-6: Dashboard avancé
- ✅ Projet cards avec thumbnails
- ✅ Statut actuel
- ✅ Quick actions (dupliquer, supprimer)
- ✅ Filtres & tri

### Semaines 7-8: Paiement
- ✅ Stripe integration
- ✅ Sélection du plan (FREE, PRO, STUDIO)
- ✅ Gérer subscription
- ✅ Quotas par plan

**Effort estimé:** 40-50 jours

---

## 📍 Phase 3: Éditeur avancé (8-10 semaines)

**Objectif:** Éditeur timeline complet + Avatars IA

### Semaines 1-2: Timeline editor
- ✅ Drag-and-drop clips
- ✅ Zoom & pan
- ✅ Playback head
- ✅ Trimming clips

### Semaines 3-4: Transitions & Effects
- ✅ Fade, Slide, Cross-dissolve
- ✅ Duration config
- ✅ Preview avec transitions

### Semaines 5-6: Audio mixing
- ✅ Ajouter musique de fond
- ✅ Volume control par clip
- ✅ Fade in/out audio

### Semaines 7-8: Avatars D-ID
- ✅ Intégration D-ID API
- ✅ Sélection d'avatar
- ✅ Génération vidéo avatar + TTS

### Semaines 9-10: Polish
- ✅ Undo/Redo
- ✅ Autosave
- ✅ Performance optimizations

**Effort estimé:** 60-80 jours

---

## 📍 Phase 4: Polish & Scaling (4-6 semaines)

**Objectif:** Production-ready + croissance utilisateurs

### Semaines 1-2: Optimisations
- ✅ Réduction taille bundle
- ✅ Lazy loading
- ✅ Image optimization
- ✅ CDN pour assets

### Semaines 3-4: Intégrations
- ✅ Exporte direct vers TikTok/Instagram
- ✅ Analytics (impression, clicks)
- ✅ Sharing avec password

### Semaines 5-6: Admin panel
- ✅ User management
- ✅ Quotas management
- ✅ Analytics dashboard
- ✅ Support ticketing

**Effort estimé:** 30-40 jours

---

## 📊 Summary par semaine

| Phase | Semaines | Effort | Dépendances |
|-------|----------|--------|-------------|
| Phase 1 | 10 | 50-60j | Setup, Core |
| Phase 2 | 8 | 40-50j | Phase 1 ✓ |
| Phase 3 | 10 | 60-80j | Phase 1-2 ✓ |
| Phase 4 | 6 | 30-40j | Phase 1-3 ✓ |
| **TOTAL** | **34** | **180-230j** | **6-9 mois** |

---

## 🎯 Milestones clés

- **M1 (Sem 10):** MVP live - premiers users
- **M2 (Sem 18):** 100 users, Templates lancés
- **M3 (Sem 28):** 500 users, Éditeur avancé
- **M4 (Sem 34):** 2000+ users, Scalabilité

---

## 🔄 Feedback loops

**Phase 1 → Feedback:**
- 5-10 beta users
- Vérifier UX basique
- Vérifier IA quality

**Phase 2 → Feedback:**
- 50 users beta
- Templates populaires?
- Pricing justifié?

**Phase 3 → Feedback:**
- 500 users
- Éditeur intuitive?
- Besoin d'autre features?

---

## 🚀 Stratégie de lancement

**MVP Launch (Phase 1):**
- Product Hunt
- Designer/Marketing forums
- Reddit r/contentcreators
- Pricing: FREE pour beta

**Growth (Phase 2+):**
- Content marketing (YouTube tutorials)
- Affiliate program
- Partnerships avec agencies
- Freemium model ($15/mois PRO)

---

## ⚠️ Risques & Mitigations

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| Runway API coûteux | HIGH | Fallback API (Replicate) |
| Video generation lent | HIGH | Cache + queue priority |
| User content size | MEDIUM | Compression + quotas |
| Scalabilité DB | MEDIUM | Read replicas Phase 2+ |
| Auth complexity | LOW | Clerk gère tout |

---

## 🎓 Apprendre en chemin

- Prisma ORM
- BullMQ queues
- Socket.io real-time
- FFmpeg processing
- IA APIs (Runway, ElevenLabs)
- Video encoding
- Payment processing

---

## 📝 Notes

- Chaque phase peut être raccourcie avec simplifications
- Implémentation parallèle possible (UI + Backend séparé)
- Tests à ajouter au fur et à mesure
- Documentation à maintenir Phase 1+
