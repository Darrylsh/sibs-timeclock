# Cloud Deployment Guide (Hetzner)

## 1. Prerequisites
-   Hetzner Server with Docker & Docker Compose installed.
-   GitHub Repository Secrets configured.

## 2. GitHub Secrets
Go to **Settings > Secrets and variables > Actions** and add:

| Secret Name | Value |
| :--- | :--- |
| `HETZNER_HOST` | IP Address of your server (p.s. `timeclock.sibs345.com` resolves to it) |
| `HETZNER_USER` | `root` or your sudo user |
| `HETZNER_SSH_KEY` | Private Key (`-----BEGIN OPENSSH PRIVATE KEY-----`) |
| `DB_USER` | `postgres` (or other) |
| `DB_PASSWORD` | Strong password for the *new* Timeclock DB |
| `JWT_SECRET` | Secret string for tokens |
| `SYNC_SECRET` | Secret string for LAN Sync |

## 3. Server Setup (One-Time)
SSH into your server and prepare the directory:
```bash
mkdir -p /opt/timeclock
```

## 4. Host Nginx Configuration
Since you already have Nginx on the host, create a new config for `timeclock.sibs345.com`:
`/etc/nginx/sites-available/timeclock`

```nginx
server {
    listen 80;
    server_name timeclock.sibs345.com;

    location / {
        # Proxy to the Docker Container (Port 4000 defined in deploy flow)
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Enable it:
```bash
ln -s /etc/nginx/sites-available/timeclock /etc/nginx/sites-enabled/
certbot --nginx -d timeclock.sibs345.com
```

## 5. First Deploy
Push to `main`. The GitHub Action will:
1.  Build Images.
2.  SCP `docker-compose.cloud.yml` to Server.
3.  Start containers exposing Port 4000.

---

## LAN Server Configuration (Home Lab)

### Environment Variables
Add these to your **LAN Server's** `.env` file:
```env
# Cloud Sync
CLOUD_API_URL=https://timeclock.sibs345.com/api/sync
CLOUD_SYNC_SECRET=your_secret_here  # Must match SYNC_SECRET on cloud
```

### Database Migration
Run the migration script to add the `cloud_event_id` column:
```bash
psql -h 192.168.10.42 -U payroll_admin -d caymanpayroll_dev -f server/migrations/add_cloud_event_id.sql
```

### Manual Sync (API)
Once logged into the Admin UI, call:
-   `POST /api/cloud-sync/pull` - Download new punches from Cloud.
-   `POST /api/cloud-sync/push` - Upload Employees/Codes to Cloud.

### Automated Sync (PM2 Cron)
Add this to your PM2 ecosystem file to run every 5 minutes:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    // ... existing app config
    {
      name: 'cloud-sync-cron',
      script: 'server/services/cloudSyncService.js',
      args: 'pull',
      cron_restart: '*/5 * * * *',
      autorestart: false
    }
  ]
}
```
