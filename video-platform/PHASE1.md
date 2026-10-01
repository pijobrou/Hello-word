# 🎬 Phase 1 - Implementation Guide

**Durée:** 6-8 semaines  
**Objectif:** MVP fonctionnel avec génération vidéo Runway + export

---

## 📋 Checklist Phase 1

- [ ] Semaines 1-2: Setup & Auth
- [ ] Semaines 3-4: Dashboard & Projects
- [ ] Semaines 5-6: Éditeur simple
- [ ] Semaines 7-8: Intégration Runway
- [ ] Semaines 9-10: Export

---

## ⚙️ Semaines 1-2: Setup & Auth

### 1.1 Initialiser le projet

```bash
cd /video-platform

# Install dependencies
npm install

# Setup DB
docker-compose up -d
npm run db:push

# Vérifier la connexion
npm run db:studio  # http://localhost:5555
```

### 1.2 Créer Clerk app

1. https://clerk.com → créer app
2. Copier CLERK_PUBLISHABLE_KEY et CLERK_SECRET_KEY
3. Ajouter dans `apps/web/.env.local` et `apps/api/.env.local`
4. Créer webhook: http://localhost:3001/webhooks/clerk

### 1.3 Configurer Next.js

**`apps/web/next.config.js`**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: '*.supabase.co' },
    ],
  },
}
module.exports = nextConfig
```

**`apps/web/app/layout.tsx`**
```tsx
import { ClerkProvider } from '@clerk/nextjs'

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

### 1.4 Protéger routes

**`apps/web/middleware.ts`**
```typescript
import { auth } from '@clerk/nextjs'
import { NextResponse } from 'next/server'

export function middleware(request: Request) {
  const { userId } = auth()
  
  if (!userId && !request.nextUrl.pathname.startsWith('/sign')) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }
}

export const config = {
  matcher: ['/((?!sign-in|sign-up|_next/static).*)'],
}
```

### 1.5 API Authentication

**`apps/api/src/middleware/auth.ts`**
```typescript
import jwt from 'jsonwebtoken'

export async function verifyAuth(token: string) {
  try {
    const decoded = jwt.verify(token, process.env.CLERK_SECRET_KEY!)
    return decoded
  } catch (e) {
    return null
  }
}

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  
  const user = verifyAuth(token)
  if (!user) return res.status(401).json({ error: 'Invalid token' })
  
  req.user = user
  next()
}
```

**✅ Fin semaine 2:** Auth complète, DB connectée

---

## 📊 Semaines 3-4: Dashboard & Projects

### 2.1 API Projects

**`apps/api/src/routes/projects.ts`**
```typescript
import express from 'express'
import { prisma } from '@videogen/db'
import { authMiddleware } from '../middleware/auth'

const router = express.Router()
router.use(authMiddleware)

// GET /api/projects
router.get('/', async (req, res) => {
  const projects = await prisma.project.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  })
  res.json({ data: projects })
})

// POST /api/projects
router.post('/', async (req, res) => {
  const { title, description } = req.body
  
  const project = await prisma.project.create({
    data: {
      title,
      description,
      userId: req.user.id,
    },
  })
  
  res.status(201).json(project)
})

// GET /api/projects/:id
router.get('/:id', async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: { clips: true },
  })
  
  if (project?.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  
  res.json(project)
})

export default router
```

### 2.2 Frontend Dashboard

**`apps/web/app/(dashboard)/layout.tsx`**
```tsx
import { Sidebar } from '@/components/Sidebar'

export default function DashboardLayout({ children }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 bg-gray-50">{children}</main>
    </div>
  )
}
```

**`apps/web/app/(dashboard)/page.tsx`**
```tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { ProjectCard } from '@/components/ProjectCard'
import { NewProjectButton } from '@/components/NewProjectButton'

export default function DashboardPage() {
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects')
      return res.json()
    },
  })
  
  if (isLoading) return <div>Loading...</div>
  
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Mes projets</h1>
        <NewProjectButton />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {projects.data.map(project => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  )
}
```

**✅ Fin semaine 4:** Dashboard fonctionnel

---

## 🎬 Semaines 5-6: Éditeur simple

**`apps/web/app/editor/[projectId]/page.tsx`**
```tsx
'use client'
import { useState } from 'react'
import { ClipList } from '@/components/ClipList'
import { ClipPreview } from '@/components/ClipPreview'
import { AddClipForm } from '@/components/AddClipForm'

export default function EditorPage({ params }) {
  const [selectedClip, setSelectedClip] = useState(null)
  
  return (
    <div className="flex gap-4 h-screen">
      {/* Sidebar: Clips */}
      <div className="w-64 bg-white border-r p-4">
        <h2 className="font-bold mb-4">Clips</h2>
        <ClipList projectId={params.projectId} onSelect={setSelectedClip} />
        <AddClipForm projectId={params.projectId} />
      </div>
      
      {/* Main: Preview + Editor */}
      <div className="flex-1 flex flex-col">
        <ClipPreview clip={selectedClip} />
        {selectedClip && <ClipEditor clip={selectedClip} />}
      </div>
    </div>
  )
}
```

**✅ Fin semaine 6:** Éditeur basique fonctionnel

---

## 🤖 Semaines 7-8: Intégration Runway

### 3.1 Setup BullMQ

**`apps/api/src/queue.ts`**
```typescript
import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL!)

export const videoGenerationQueue = new Queue('video-generation', { connection: redis })

// Worker
new Worker('video-generation', async (job) => {
  const { clipId, prompt, style } = job.data
  
  // Appeler Runway API
  const videoUrl = await generateWithRunway(prompt, style)
  
  // Sauvegarder dans Supabase
  const url = await uploadToSupabase(videoUrl, clipId)
  
  // Update clip
  await prisma.clip.update({
    where: { id: clipId },
    data: { outputUrl: url, status: 'READY' },
  })
  
  return { success: true, url }
}, { connection: redis })
```

### 3.2 API Runway

**`apps/api/src/services/runway.ts`**
```typescript
import axios from 'axios'

const runwayClient = axios.create({
  baseURL: 'https://api.runwayml.com/v1',
  headers: {
    Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
  },
})

export async function generateWithRunway(prompt: string, style: string) {
  const response = await runwayClient.post('/tasks', {
    type: 'gen3',
    model: 'gen3',
    prompt: `${prompt} (style: ${style})`,
    duration: 5,
  })
  
  // Poll for completion
  let task = response.data
  while (task.status !== 'SUCCEEDED') {
    await new Promise(r => setTimeout(r, 5000))
    const { data } = await runwayClient.get(`/tasks/${task.id}`)
    task = data
  }
  
  return task.output[0].url
}
```

### 3.3 Créer clip + enqueue

**`apps/api/src/routes/clips.ts`**
```typescript
router.post('/:projectId/clips', authMiddleware, async (req, res) => {
  const { type, title, prompt, style, duration } = req.body
  
  // Créer clip
  const clip = await prisma.clip.create({
    data: {
      projectId: req.params.projectId,
      type,
      title,
      prompt,
      style,
      duration,
      status: 'PENDING',
    },
  })
  
  // Si AI_GENERATED, enqueue job
  if (type === 'AI_GENERATED') {
    await videoGenerationQueue.add('generate', {
      clipId: clip.id,
      prompt,
      style,
    })
  }
  
  res.status(201).json(clip)
})
```

### 3.4 WebSocket pour updates

**`apps/api/src/socket.ts`**
```typescript
import { Server } from 'socket.io'

export function setupSocket(io: Server) {
  io.on('connection', (socket) => {
    socket.on('watch-clip', ({ clipId }) => {
      socket.join(`clip:${clipId}`)
    })
  })
  
  // Quand le job se termine
  videoGenerationQueue.on('completed', (job) => {
    const { clipId } = job.data
    io.to(`clip:${clipId}`).emit('clip:ready', { clipId })
  })
}
```

**Frontend listener:**
```tsx
useEffect(() => {
  socket.emit('watch-clip', { clipId: selectedClip.id })
  
  socket.on('clip:ready', ({ clipId }) => {
    // Refetch clip
    refetchClip()
  })
}, [selectedClip])
```

**✅ Fin semaine 8:** Génération vidéo IA fonctionnelle

---

## 💾 Semaines 9-10: Export

### 4.1 API Export

```typescript
router.post('/exports', authMiddleware, async (req, res) => {
  const { projectId, format, resolution } = req.body
  
  // Créer export
  const exp = await prisma.export.create({
    data: {
      userId: req.user.id,
      projectId,
      format,
      resolution,
      status: 'QUEUED',
    },
  })
  
  // Enqueue job
  await exportQueue.add('export', {
    exportId: exp.id,
    projectId,
    format,
    resolution,
  })
  
  res.status(201).json(exp)
})
```

### 4.2 Worker Export

```typescript
new Worker('export', async (job) => {
  const { exportId, projectId, format, resolution } = job.data
  
  // Récupérer tous les clips
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { clips: true },
  })
  
  // Compiler avec FFmpeg
  const videoPath = await compileVideos(project.clips, resolution)
  
  // Upload to Supabase
  const url = await uploadToSupabase(videoPath, exportId)
  
  // Update export
  await prisma.export.update({
    where: { id: exportId },
    data: { fileUrl: url, status: 'READY' },
  })
})
```

### 4.3 Frontend Export

```tsx
async function handleExport() {
  const res = await fetch('/api/exports', {
    method: 'POST',
    body: JSON.stringify({
      projectId,
      format: 'MP4',
      resolution: 'P1080',
    }),
  })
  
  const exp = await res.json()
  
  // Watch for completion
  socket.on('export:completed', ({ exportId }) => {
    if (exportId === exp.id) {
      window.location.href = exp.fileUrl
    }
  })
}
```

**✅ Fin semaine 10 (Phase 1):** MVP complet & fonctionnel 🎉

---

## 📝 Prochaines étapes

1. **Tester en production** (Vercel + Railway)
2. **Beta users** (5-10 personnes)
3. **Feedback loop**
4. **Phase 2:** Templates + TTS

---

## 🆘 Ressources & Help

- [Runaway API Docs](https://docs.runwayml.com)
- [Prisma Docs](https://www.prisma.io/docs/)
- [Express Guide](https://expressjs.com/)
- [Socket.io Guide](https://socket.io/docs/)
