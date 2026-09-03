# Kolonna StoreTrack — Deployment & Maintenance Guide

This guide covers deploying the system to a production server, keeping it running reliably,
and performing routine maintenance tasks. For local development setup, see [SETUP.md](SETUP.md).

---

## Table of Contents

1. [Production Prerequisites](#1-production-prerequisites)
2. [Pre-Deployment Checklist](#2-pre-deployment-checklist)
3. [Database Setup (MySQL)](#3-database-setup-mysql)
4. [Backend Deployment (Linux Server)](#4-backend-deployment-linux-server)
5. [Frontend Deployment](#5-frontend-deployment)
6. [Nginx Reverse Proxy](#6-nginx-reverse-proxy)
7. [Docker Quick-Start](#7-docker-quick-start)
8. [Free Demo Hosting (Neon + Render + Vercel)](#8-free-demo-hosting-neon--render--vercel)
9. [Backup Schedule](#9-backup-schedule)
10. [Maintenance Procedures](#10-maintenance-procedures)
11. [Health Monitoring](#11-health-monitoring)

---

## 1. Production Prerequisites

Install the following on your server before deploying:

| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| Python | 3.10+ | Backend runtime |
| pip | latest | Python package manager |
| Node.js | 18+ | Frontend build (build once, deploy static files) |
| MySQL | 8.0+ | Production database (or PostgreSQL 14+) |
| Nginx | 1.18+ | Reverse proxy / static file serving |
| Git | any | Pulling updates |

**Recommended OS:** Ubuntu 22.04 LTS or later.

---

## 2. Pre-Deployment Checklist

Complete these steps before going live:

- [ ] Change `SECRET_KEY` in `.env` to a long, random string (at least 32 characters)
- [ ] Change `ADMIN_PASSWORD` in `.env` (or change via the Users page after first login)
- [ ] Set `DATABASE_URL` to your production MySQL/PostgreSQL connection string
- [ ] Set `CORS_ORIGINS` to your exact frontend domain (e.g., `https://storetrack.kolonna.lk`)
- [ ] Confirm HTTPS is configured (Nginx with a TLS certificate, e.g., via Let's Encrypt)
- [ ] Confirm the database user has only the required permissions (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE` for initial migration)
- [ ] Run the test suite: `cd backend && pytest tests/ -v` — all tests must pass

---

## 3. Database Setup (MySQL)

### Create the database and user

Log in to MySQL as root, then:

```sql
CREATE DATABASE kolonna_storetrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'storetrack'@'localhost' IDENTIFIED BY 'your-strong-db-password';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER
  ON kolonna_storetrack.*
  TO 'storetrack'@'localhost';

FLUSH PRIVILEGES;
```

> **Security note:** After the first startup (which runs `CREATE TABLE` migrations automatically),
> you can revoke `CREATE`, `DROP`, `ALTER`, and `INDEX` from the database user — the application
> only needs `SELECT`, `INSERT`, `UPDATE`, and `DELETE` during normal operation.

### Set `DATABASE_URL` in `backend/.env`

```
DATABASE_URL=mysql+pymysql://storetrack:your-strong-db-password@localhost:3306/kolonna_storetrack
```

---

## 4. Backend Deployment (Linux Server)

### Clone and install

```bash
git clone https://github.com/Narmada2001/kolonna-storetrack.git /srv/kolonna-storetrack
cd /srv/kolonna-storetrack/backend

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Configure environment

```bash
cp .env.example .env
nano .env     # Fill in all production values
```

### Seed the database (first time only)

```bash
source .venv/bin/activate
python -m app.seed
```

### Create a systemd service

Create `/etc/systemd/system/storetrack-api.service`:

```ini
[Unit]
Description=Kolonna StoreTrack API
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/srv/kolonna-storetrack/backend
Environment="PATH=/srv/kolonna-storetrack/backend/.venv/bin"
ExecStart=/srv/kolonna-storetrack/backend/.venv/bin/uvicorn app.main:app \
          --host 127.0.0.1 \
          --port 8000 \
          --workers 2
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable storetrack-api
sudo systemctl start storetrack-api
sudo systemctl status storetrack-api    # confirm it's active
```

### View logs

```bash
sudo journalctl -u storetrack-api -f          # live log stream
sudo journalctl -u storetrack-api --since today  # today's logs
```

---

## 5. Frontend Deployment

Build the production bundle on the server (or your local machine and copy it):

```bash
cd /srv/kolonna-storetrack/frontend
npm install
cp .env.example .env
# Edit .env: VITE_API_URL=https://api.storetrack.kolonna.lk
npm run build
```

The build output is in `frontend/dist/`. Serve this as static files via Nginx (see next section).

---

## 6. Nginx Reverse Proxy

Create `/etc/nginx/sites-available/storetrack`:

```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name storetrack.kolonna.lk api.storetrack.kolonna.lk;
    return 301 https://$host$request_uri;
}

# Frontend (React SPA)
server {
    listen 443 ssl http2;
    server_name storetrack.kolonna.lk;

    ssl_certificate     /etc/letsencrypt/live/storetrack.kolonna.lk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/storetrack.kolonna.lk/privkey.pem;

    root /srv/kolonna-storetrack/frontend/dist;
    index index.html;

    # SPA fallback — serve index.html for all unknown paths
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively
    location ~* \.(js|css|png|jpg|svg|ico|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Backend API
server {
    listen 443 ssl http2;
    server_name api.storetrack.kolonna.lk;

    ssl_certificate     /etc/letsencrypt/live/api.storetrack.kolonna.lk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.storetrack.kolonna.lk/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        client_max_body_size 10M;
    }
}
```

Enable the site and obtain TLS certificates:

```bash
sudo ln -s /etc/nginx/sites-available/storetrack /etc/nginx/sites-enabled/
sudo nginx -t                     # test config
sudo certbot --nginx -d storetrack.kolonna.lk -d api.storetrack.kolonna.lk
sudo systemctl reload nginx
```

---

## 7. Docker Quick-Start

For teams who prefer Docker, here is a minimal `docker-compose.yml` for local or staging use.
Create this file at the project root:

```yaml
version: "3.9"

services:
  db:
    image: mysql:8.0
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: kolonna_storetrack
      MYSQL_USER: storetrack
      MYSQL_PASSWORD: storetrack_pass
      MYSQL_ROOT_PASSWORD: root_pass
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"

  api:
    build: ./backend
    restart: unless-stopped
    depends_on:
      - db
    environment:
      DATABASE_URL: mysql+pymysql://storetrack:storetrack_pass@db:3306/kolonna_storetrack
      SECRET_KEY: change-me-in-production
      CORS_ORIGINS: http://localhost:5173
    ports:
      - "8000:8000"
    command: >
      sh -c "python -m app.seed &&
             uvicorn app.main:app --host 0.0.0.0 --port 8000"

  frontend:
    build: ./frontend
    restart: unless-stopped
    ports:
      - "5173:80"
    depends_on:
      - api

volumes:
  mysql_data:
```

You also need a `backend/Dockerfile`:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
```

And a `frontend/Dockerfile`:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Start everything:

```bash
docker compose up -d
```

---

## 8. Free Demo Hosting (Neon + Render + Vercel)

See the **Free demo hosting** section in [README.md](README.md) for a full walkthrough using:
- **Neon** — free PostgreSQL database
- **Render** — free backend hosting
- **Vercel** — free frontend hosting

This setup is suitable for demonstrations to mentors/staff only. For the Secretariat's real
production system, use the self-hosted approach in sections 3–6 above.

---

## 9. Backup Schedule

### Manual backup (on demand)

```bash
cd /srv/kolonna-storetrack/backend
source .venv/bin/activate
python -m app.backup            # creates a timestamped backup in backend/backups/
python -m app.backup --list     # lists existing backups (newest first)
```

The script keeps only the most recent **14 backups** and deletes older ones automatically.

### Automated daily backup (Linux cron)

Edit the crontab for the `www-data` user:

```bash
sudo crontab -u www-data -e
```

Add this line to back up every night at **2:00 AM**:

```cron
0 2 * * * cd /srv/kolonna-storetrack/backend && .venv/bin/python -m app.backup >> /var/log/storetrack-backup.log 2>&1
```

### Off-site backup (recommended)

Copy the backup folder to an off-site location weekly. Example using `rsync`:

```bash
rsync -avz /srv/kolonna-storetrack/backend/backups/ \
      user@backup-server:/backups/kolonna-storetrack/
```

Or use `rclone` to sync to a cloud storage bucket (Google Drive, S3, etc.).

### MySQL native backup (alternative)

For larger databases, use `mysqldump` directly:

```bash
mysqldump -u storetrack -p kolonna_storetrack \
  | gzip > /backups/kolonna_$(date +%Y%m%d_%H%M%S).sql.gz
```

---

## 10. Maintenance Procedures

### Updating the application

```bash
cd /srv/kolonna-storetrack

# 1. Pull latest changes
git pull origin main

# 2. Update Python dependencies
source backend/.venv/bin/activate
pip install -r backend/requirements.txt

# 3. Update frontend dependencies and rebuild
cd frontend
npm install
npm run build
cd ..

# 4. Restart the API service
sudo systemctl restart storetrack-api

# 5. Reload Nginx (if Nginx config changed)
sudo nginx -t && sudo systemctl reload nginx
```

### Rotating secrets

When rotating the `SECRET_KEY` (e.g., after a suspected compromise):
1. Generate a new key: `python3 -c "import secrets; print(secrets.token_hex(32))"`
2. Update `SECRET_KEY` in `backend/.env`
3. Restart the service: `sudo systemctl restart storetrack-api`
4. **All existing JWT tokens will be immediately invalidated** — all users will need to log in again. This is expected and correct.

### Changing the admin password

Log in as admin via the web UI → **Users** page → click **Edit** on the admin account → set a new password. Minimum 8 characters.

Alternatively, use the API directly:

```bash
# First, get a token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kolonna.lk","password":"old-password"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Get admin user ID (first user in the list)
ADMIN_ID=$(curl -s http://localhost:8000/users \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

# Set new password
curl -X PUT http://localhost:8000/users/$ADMIN_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"NewSecurePassword@2025"}'
```

### Deactivating a user account

If an employee leaves, deactivate their account rather than deleting it (preserves the audit trail):
- Web UI → **Users** → Edit → toggle **Active** off.
- The user will be immediately prevented from logging in.

### Log rotation

Configure `logrotate` to rotate the API logs:

Create `/etc/logrotate.d/storetrack`:

```
/var/log/storetrack-backup.log {
    daily
    rotate 30
    compress
    missingok
    notifempty
    create 0640 www-data www-data
}
```

---

## 11. Health Monitoring

### Built-in health endpoint

The API exposes a health check endpoint:

```
GET /health
```

Response:
```json
{ "status": "ok" }
```

Use this in your load balancer, uptime monitor, or systemd watchdog.

### Simple uptime monitoring

Use a free tool like **UptimeRobot** or **Freshping**:
1. Create a new monitor: HTTP(S) type
2. URL: `https://api.storetrack.kolonna.lk/health`
3. Check interval: every 5 minutes
4. Alert via email/Telegram if the endpoint goes down

### Systemd watchdog (automatic restart)

The systemd service is already configured with `Restart=on-failure`. To confirm it is
auto-restarting after crashes:

```bash
sudo systemctl status storetrack-api
# Look for "Active: active (running)" and the restart count
```

### Disk space monitoring

Backups and logs accumulate over time. Set up a simple alert:

```bash
# Add to crontab — alerts if disk usage exceeds 85%
0 8 * * * df -h / | awk 'NR==2 {gsub(/%/,""); if ($5 > 85) print "ALERT: Disk "$5"% full on storetrack server"}' | mail -s "Disk Alert" admin@kolonna.lk
```

---

*For questions about this guide, refer to the project repository or the IS5109 Community Project report.*
