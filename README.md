# Codex Skilled

Greenfield MVP for an agent workspace platform.

## Stack

- Angular 21 frontend with Bootstrap CSS
- NestJS backend
- MySQL with Prisma
- Redis/BullMQ for async jobs
- Firebase Google authentication
- Host runner process for locally authenticated Codex and Claude CLI execution

## Layout

- `frontend/` Angular app
- `backend/` NestJS API
- `runner/` trusted host runner bridge
- `docker-compose.yml` local container stack
- `workspace-data/` local user workspaces and generated artifacts

## Local Development

1. Copy `.env.example` to `.env` and fill Firebase values. `NG_APP_FIREBASE_APP_ID` is optional for the MVP because Google auth does not require Firebase Analytics.
2. Install dependencies in each Node project.
3. For hot-reload development, start MySQL, Redis, backend, and frontend:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

The dev override runs Nest and Angular in watch mode with bind mounts. The runner must run on the host so it can use your authenticated local CLIs.

For production-style local images, start MySQL, Redis, backend, and frontend:

```powershell
docker compose up --build
```

4. Start the runner on the host:

```powershell
cd runner
npm install
$env:RUNNER_SHARED_SECRET='change-me'
$env:HOST_WORKSPACE_ROOT=(Resolve-Path ..\workspace-data).Path
npm run dev
```

The backend calls the host runner at `HOST_RUNNER_URL`.
