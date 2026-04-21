# Device Heartbeat Platform

This repository now contains two tracks:

- `server.js` and `client.js`: legacy prototype reference.
- `apps/api`, `apps/web`, `apps/edge-agent`: the new full-stack heartbeat platform.

## Stack

- API: Node.js, Express, Sequelize, Postgres, WebSocket
- Web: React, Vite, shadcn-style component primitives, TanStack Query, Zustand
- Edge: Python agent sending heartbeats over WebSocket
- Database: Postgres in Docker only

## Local development

1. Copy environment files:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/edge-agent/.env.example .env.edge
```

2. Start Postgres:

```bash
npm run db:up
```

3. Install dependencies:

```bash
npm install
cd apps/edge-agent && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
```

4. Run migrations and seed the first admin:

```bash
npm run db:migrate
npm run db:seed-admin
```

5. Start the API and web app in separate terminals:

```bash
npm run dev:api
npm run dev:web
```

6. Start the edge agent:

```bash
cd apps/edge-agent
python3 -m edge_agent.cli --config ../../.env.edge
```

## Core flows

- Admin signs in through the portal.
- Edge agent requests a pairing session and displays a one-time code.
- Admin enters the code in the portal.
- API issues a device credential.
- Edge agent opens an authenticated WebSocket connection and sends recurring heartbeats.
- Dashboard, device pages, and reports reflect online/offline and service uptime state.

## Local database port

The Compose-managed Postgres container defaults to host port `55432` to avoid conflicts with any Postgres instance already running on your machine.

## Legacy prototype

The original `server.js` and `client.js` are preserved for reference during migration. They are no longer the primary app entrypoints.
