# 📡 API Reference - VideoGen

## Authentication

Tous les endpoints (sauf /auth/*) requièrent un header:
```
Authorization: Bearer <jwt_token>
```

## Base URL

Development: `http://localhost:3001`
Production: `https://api.videogen.com`

## Projects

### GET /api/projects
Récupère tous les projets de l'utilisateur

**Query:**
- `status`: DRAFT | IN_PROGRESS | COMPLETED | ARCHIVED

**Response:**
```json
{
  "data": [
    {
      "id": "proj_123",
      "title": "Mon projet marketing",
      "status": "DRAFT",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### POST /api/projects
Crée un nouveau projet

**Body:**
```json
{
  "title": "Nouvelle vidéo",
  "description": "Description optionnelle"
}
```

**Response:** `201 Created`
```json
{
  "id": "proj_123",
  "title": "Nouvelle vidéo",
  "status": "DRAFT"
}
```

### GET /api/projects/:id
Détails d'un projet

**Response:**
```json
{
  "id": "proj_123",
  "title": "Mon projet",
  "status": "DRAFT",
  "clips": [
    {
      "id": "clip_456",
      "type": "TEXT",
      "content": "Bonjour le monde",
      "status": "READY"
    }
  ]
}
```

### PATCH /api/projects/:id
Mise à jour d'un projet

**Body:**
```json
{
  "title": "Nouveau titre",
  "status": "IN_PROGRESS"
}
```

### DELETE /api/projects/:id
Supprime un projet

## Clips

### POST /api/projects/:projectId/clips
Crée un nouveau clip

**Body:**
```json
{
  "type": "AI_GENERATED",
  "title": "Intro vidéo",
  "prompt": "Une intro professionnelle pour une agence marketing",
  "style": "PROFESSIONAL",
  "duration": 5000
}
```

**Response:** `201 Created`
```json
{
  "id": "clip_123",
  "status": "PROCESSING",
  "type": "AI_GENERATED"
}
```

### GET /api/projects/:projectId/clips
Liste les clips d'un projet

**Response:**
```json
{
  "data": [
    {
      "id": "clip_123",
      "type": "AI_GENERATED",
      "status": "READY",
      "outputUrl": "https://supabase.com/..."
    }
  ]
}
```

### PATCH /api/clips/:id
Mise à jour d'un clip

**Body:**
```json
{
  "title": "Nouveau titre",
  "startTime": 2000
}
```

### DELETE /api/clips/:id
Supprime un clip

## Templates

### GET /api/templates
Liste tous les templates

**Query:**
- `category`: MARKETING | SOCIAL | EXPLAINER | etc
- `public`: true | false

**Response:**
```json
{
  "data": [
    {
      "id": "tpl_123",
      "name": "Intro marketing",
      "category": "MARKETING",
      "thumbnail": "https://...",
      "config": {
        "duration": 5000,
        "transitions": "fade"
      }
    }
  ]
}
```

### GET /api/templates/:id
Détails d'un template

### POST /api/projects/:projectId/from-template
Crée un projet à partir d'un template

**Body:**
```json
{
  "templateId": "tpl_123",
  "title": "Mon projet à partir du template"
}
```

## Exports

### POST /api/exports
Lance un export vidéo

**Body:**
```json
{
  "projectId": "proj_123",
  "format": "MP4",
  "resolution": "P1080"
}
```

**Response:** `201 Created`
```json
{
  "id": "exp_123",
  "status": "QUEUED",
  "format": "MP4",
  "resolution": "P1080"
}
```

### GET /api/exports/:id
Statut d'un export

**Response:**
```json
{
  "id": "exp_123",
  "status": "PROCESSING",
  "progress": 45,
  "fileUrl": null
}
```

**Status values:**
- `QUEUED` - Attente
- `PROCESSING` - En cours
- `READY` - Prêt à télécharger
- `ERROR` - Erreur

### DELETE /api/exports/:id
Supprime un export

## User

### GET /api/user/profile
Profil de l'utilisateur connecté

**Response:**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "Jean Dupont",
  "tier": "PRO",
  "stripeId": "cus_...",
  "createdAt": "2024-01-10T10:30:00Z"
}
```

### PATCH /api/user/profile
Mise à jour du profil

**Body:**
```json
{
  "name": "Jean Dupont",
  "image": "https://..."
}
```

### GET /api/user/quota
Vérifier les quotas (FREE plan)

**Response:**
```json
{
  "tier": "FREE",
  "exportsLimit": 5,
  "exportsUsed": 2,
  "storageLimit": 1000000000,
  "storageUsed": 250000000
}
```

## Webhooks (Socket.io)

Real-time events via WebSocket :

```javascript
import io from 'socket.io-client'

const socket = io('http://localhost:3001')

// Connect avec JWT
socket.auth = { token: jwtToken }
socket.connect()

// Listen to events
socket.on('clip:ready', (data) => {
  console.log('Clip prêt:', data.clipId)
})

socket.on('export:progress', (data) => {
  console.log('Progress:', data.progress + '%')
})

socket.on('export:completed', (data) => {
  console.log('Export finalisé:', data.fileUrl)
})
```

## Error Handling

Tous les erreurs retournent JSON :

```json
{
  "error": "Clip not found",
  "code": "CLIP_NOT_FOUND",
  "statusCode": 404
}
```

**Codes courants:**
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden (pas propriétaire)
- `404` - Not Found
- `429` - Too Many Requests (rate limit)
- `500` - Server Error

## Rate Limiting

- Authentifié: 100 req/minute
- Anonymous: 10 req/minute

Header: `X-RateLimit-Remaining`

## Pagination

```
GET /api/projects?page=1&limit=20

Response:
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```
