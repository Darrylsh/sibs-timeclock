# Development Guide - Sibs Timeclock

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUD (Hetzner)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   PWA       │  │   API       │  │   Postgres          │  │
│  │  (Nginx)    │──│  (Node)     │──│   (timeclock_prod)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         ▲                                                   │
└─────────│───────────────────────────────────────────────────┘
          │ HTTPS
          │
    ┌─────┴─────┐
    │  Phone    │  ◄── Users punch in/out
    │  Browser  │
    └───────────┘
```

---

## Local Development

### Prerequisites
- Node.js 18+
- Git

### Setup
```bash
cd C:\Users\darry\Desktop\sibs-timeclock

# Install PWA deps
cd timeclock-pwa && npm install

# Install API deps
cd ../server-cloud && npm install
```

### Run Locally
```bash
# Terminal 1: PWA (port 5173)
cd timeclock-pwa
npm run dev

# Terminal 2: API (port 3000)
cd server-cloud
npm run dev
```

Create a `.env` in `server-cloud/`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=timeclock_dev
JWT_SECRET=dev_secret
SYNC_SECRET=dev_sync
```

---

## Deployment Pipeline

### Automatic (via GitHub Actions)

```
git push → GitHub Actions → Docker Build → Push to GHCR → Deploy to Hetzner
```

**Trigger:** Any push to `main` that changes:
- `server-cloud/**`
- `timeclock-pwa/**`
- `docker-compose.cloud.yml`

### Manual Deploy
```bash
ssh your-hetzner-server
cd /opt/timeclock
docker compose pull
docker compose up -d
```

---

## Project Structure

```
sibs-timeclock/
├── .github/workflows/
│   └── deploy-cloud.yml     # CI/CD pipeline
├── server-cloud/            # Backend API
│   ├── routes/
│   │   ├── auth.js          # Login endpoint
│   │   ├── events.js        # Punch upload
│   │   ├── config.js        # Work codes fetch
│   │   └── sync.js          # LAN polling endpoints
│   ├── db.js                # Postgres connection
│   ├── index.js             # Express server
│   └── Dockerfile
├── timeclock-pwa/           # Frontend PWA
│   ├── src/
│   │   ├── screens/         # React screens
│   │   ├── api.ts           # API client
│   │   └── db.ts            # IndexedDB (offline)
│   ├── nginx-pwa.conf       # Nginx config for container
│   └── Dockerfile
├── docker-compose.cloud.yml # Production orchestration
├── nginx-proxy.conf         # Internal proxy config
└── README.md                # Deployment guide
```

---

## Common Tasks

### Add a new API endpoint
1. Create/edit file in `server-cloud/routes/`
2. Import and mount in `server-cloud/index.js`
3. Test locally, then push

### Update PWA UI
1. Edit files in `timeclock-pwa/src/`
2. Test with `npm run dev`
3. Commit & push → auto-deploys

### Database migrations
1. SSH to Hetzner
2. `docker exec -it timeclock-db-1 psql -U postgres -d timeclock_prod`
3. Run your SQL

### View logs
```bash
ssh your-hetzner-server
cd /opt/timeclock
docker compose logs -f api    # API logs
docker compose logs -f pwa    # Nginx logs
```

---

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `DB_*` | GitHub Secrets | Database connection |
| `JWT_SECRET` | GitHub Secrets | Token signing |
| `SYNC_SECRET` | GitHub Secrets | LAN sync auth |
| `HOST_PORT` | .env on server | External port (4000) |

---

## Troubleshooting

**Build fails?**
- Check GitHub Actions logs
- Ensure Dockerfile syntax is correct

**Deploy fails?**
- Verify GitHub Secrets are set
- Check SSH key has access to Hetzner

**App not loading?**
- `docker compose logs -f` on server
- Check Nginx config on host
