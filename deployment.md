# Haybu Deployment Guide

This runbook is for staging Haybu on a test server.

It is written for an operator or autonomous agent and assumes:
- Linux server
- `git`, `docker`, `docker compose`, `node >= 20`, `npm`, `python3`
- PM2 will manage the API and web services
- Postgres is the only containerized service

This document is intentionally split into:
- local dev/test setup
- server deployment setup

Do not mix them.

## 1. Deployment model

Server deployment for this repo should use:
- `postgres` in Docker Compose
- `haybu-api` as a PM2-managed Node service
- `haybu-web` as a PM2-managed Vite preview service
- optional reverse proxy in front of both

Recommended ports:
- Postgres: `55432`
- API: `4000`
- Web: `4173`

Recommended public routing:
- `https://your-domain` -> `http://127.0.0.1:4173`
- API routes proxied to `http://127.0.0.1:4000`
- WebSocket `/ws/devices` proxied to `ws://127.0.0.1:4000/ws/devices`

## 2. Local dev/test setup

This is your current development arrangement. Keep it separate from deployment.

Local dev/test uses:
- Postgres in Docker
- API run directly from the repo
- web run directly from the repo with Vite dev server
- edge agent run directly from the repo

Local dev/test commands:

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/edge-agent/.env.example .env.edge
npm run db:up
npm run db:migrate
npm run db:seed-admin
npm run dev:api
npm run dev:web
```

Optional local edge agent:

```bash
cd apps/edge-agent
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python3 -m edge_agent.cli --config ../../.env.edge
```

That is not the deployment model.

## 3. Server deployment setup

Clone the repo onto the server:

```bash
git clone <your-repo-url> /opt/haybu
cd /opt/haybu
npm install
```

Install PM2 globally if not already installed:

```bash
npm install -g pm2
```

If you also want an edge agent on the server for staging tests:

```bash
cd apps/edge-agent
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cd /opt/haybu
```

## 4. Prepare environment files

Create:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Optional:

```bash
cp apps/edge-agent/.env.example .env.edge
```

## 5. Configure API environment

Edit [apps/api/.env](/Users/ninoreyjandayan/Documents/GitHub/node-heartbeat/apps/api/.env).

Example staging values:

```env
PORT=4000
CLIENT_ORIGIN=https://your-domain
DATABASE_URL=postgres://haybu:<strong-password>@127.0.0.1:55432/haybu
JWT_ACCESS_SECRET=<long-random-secret>
JWT_REFRESH_SECRET=<different-long-random-secret>
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
PAIRING_CODE_TTL_MINUTES=10
DEVICE_OFFLINE_GRACE_SECONDS=180
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<strong-password>
```

Notes:
- `CLIENT_ORIGIN` must match the browser origin serving the Haybu web app.
- Use a comma-separated value if you need more than one allowed origin.
- Replace the default secrets with real random values.

## 6. Configure web environment

Edit [apps/web/.env](/Users/ninoreyjandayan/Documents/GitHub/node-heartbeat/apps/web/.env).

For a proxied single-domain staging setup:

```env
VITE_API_URL=https://your-domain
```

For separate web and API origins:

```env
VITE_API_URL=https://api.your-domain
```

Important:
- The frontend currently expects API paths like `/auth`, `/devices`, `/reports`, `/pairing`.
- If you proxy the API under `/api`, you must first change frontend API base handling.
- For the current codebase, the simplest deployment is to proxy those root API paths directly.

## 7. Start Postgres

Postgres is the only containerized runtime in deployment.

Set Compose values:

```bash
export POSTGRES_DB=haybu
export POSTGRES_USER=haybu
export POSTGRES_PASSWORD='<strong-password>'
export POSTGRES_PORT=55432
```

Start the DB:

```bash
npm run db:up
```

Check it:

```bash
docker compose -f infra/postgres/docker-compose.yml ps
docker compose -f infra/postgres/docker-compose.yml logs --tail=100 postgres
```

## 8. Initialize schema and admin user

Run:

```bash
npm run db:migrate
npm run db:seed-admin
```

## 9. Build the web app

Build once before starting the web service:

```bash
npm --workspace apps/web run build
```

Output path:

```text
apps/web/dist
```

## 10. Run API and web as PM2 services

This is the deployment standard for this repo.

Start the API:

```bash
pm2 start npm --name haybu-api --workspace apps/api -- run start
```

Start the built web app using Vite preview:

```bash
pm2 start npm --name haybu-web --workspace apps/web -- run preview -- --host 0.0.0.0 --port 4173
```

Check processes:

```bash
pm2 status
pm2 logs haybu-api --lines 100
pm2 logs haybu-web --lines 100
```

Persist PM2 on reboot:

```bash
pm2 save
pm2 startup
```

Follow the printed `pm2 startup` command exactly, then run:

```bash
pm2 save
```

## 11. Optional reverse proxy

Recommended if the server is internet-facing.

Example nginx site:

```nginx
server {
    listen 80;
    server_name your-domain;

    location / {
        proxy_pass http://127.0.0.1:4173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /auth/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /users/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /devices/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /pairing/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /reports/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/devices {
        proxy_pass http://127.0.0.1:4000/ws/devices;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

For TLS, add your normal HTTPS certificate flow and switch the public URLs to `https://` / `wss://`.

## 12. Verify deployment

Check API health directly:

```bash
curl -s http://127.0.0.1:4000/health
```

Expected:

```json
{"ok":true}
```

Check web directly:

```bash
curl -I http://127.0.0.1:4173
```

Then test in browser:
- open the staging URL
- sign in using `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- confirm dashboard loads
- confirm charts render

Then test pairing:
- run an edge agent
- enter the pairing code in the portal
- confirm the device appears

## 13. Configure an edge agent for staging

Edit `.env.edge` on the edge machine:

```env
API_BASE_URL=https://your-domain
WS_BASE_URL=wss://your-domain/ws/devices
DEVICE_NAME=
HEARTBEAT_INTERVAL_SECONDS=30
STATE_DIR=.edge-state
SERVICES_JSON=[
  {"name":"nginx","type":"tcp","host":"127.0.0.1","port":80}
]
```

Notes:
- Leave `DEVICE_NAME` empty to use the machine hostname.
- `SERVICES_JSON` must remain valid JSON.
- For non-TLS staging, use `http://` and `ws://`.

Run:

```bash
cd /opt/haybu/apps/edge-agent
. .venv/bin/activate
python3 -m edge_agent.cli --config ../../.env.edge
```

If reusing an already-paired edge node:

```bash
python3 -m edge_agent.cli --config ../../.env.edge --reset-pairing
```

## 14. Upgrade procedure

For a normal staged update:

```bash
cd /opt/haybu
git pull
npm install
npm run db:migrate
npm --workspace apps/web run build
pm2 restart haybu-api
pm2 restart haybu-web
```

Verify:

```bash
pm2 status
curl -s http://127.0.0.1:4000/health
```

## 15. Rollback procedure

If the new revision is bad:
1. inspect PM2 logs
2. roll back to the previous known-good commit
3. reinstall if needed
4. rebuild web
5. restart PM2 services

Example:

```bash
cd /opt/haybu
git log --oneline -n 5
git checkout <previous-good-commit>
npm install
npm --workspace apps/web run build
pm2 restart haybu-api
pm2 restart haybu-web
```

Do not destroy the Postgres volume unless you explicitly intend to wipe data.

## 16. Operational notes

- The API hosts its own WebSocket endpoint at `/ws/devices`.
- The API boot path currently does:
  - DB authenticate
  - schema sync
  - admin bootstrap
  - scheduler start
- Trend charts now use real stored heartbeat history:
  - hourly
  - daily
  - weekly
- Retention and raw flush settings are available from the Haybu admin UI after login.

## 17. Fast deployment checklist

Use this exact sequence for a fresh test server:

```bash
git clone <your-repo-url> /opt/haybu
cd /opt/haybu
npm install
npm install -g pm2
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
export POSTGRES_DB=haybu
export POSTGRES_USER=haybu
export POSTGRES_PASSWORD='<strong-password>'
export POSTGRES_PORT=55432
npm run db:up
npm run db:migrate
npm run db:seed-admin
npm --workspace apps/web run build
pm2 start npm --name haybu-api --workspace apps/api -- run start
pm2 start npm --name haybu-web --workspace apps/web -- run preview -- --host 0.0.0.0 --port 4173
pm2 save
```

Expected result:
- Postgres running in Docker
- `haybu-api` running in PM2 on `:4000`
- `haybu-web` running in PM2 on `:4173`
- browser login available
- edge-agent pairing available
