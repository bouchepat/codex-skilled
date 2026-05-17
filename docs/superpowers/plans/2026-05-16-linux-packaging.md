# Linux Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the full Codex Skilled stack for Linux as a Docker Compose deployment, including a containerized runner that can execute the approved CLI toolchain and write resumable session artifacts.

**Architecture:** Keep the existing product model intact. The backend remains the policy gate and job dispatcher, the frontend remains a static Angular container, MySQL and Redis stay as persistent services, and the runner becomes a Linux container on the compose network. The runner must be able to find the Codex and Claude CLI binaries through an explicit container path contract, while session state and artifacts continue to live under the shared workspace volume.

**Tech Stack:** Docker Compose, Node.js 22, NestJS, Angular 21, MySQL 8.4, Redis 7, Express inside the runner service.

---

### Task 1: Make the runner container-ready for Linux CLI execution

**Files:**
- Modify: `runner/src/process-runner.ts`
- Modify: `runner/src/main.ts`
- Modify: `runner/README.md`
- Modify: `runner/Dockerfile`

- [ ] **Step 1: Add an explicit CLI path contract to process spawning**

```ts
function buildEnvWithCliPaths(): NodeJS.ProcessEnv {
  const cliPathEntries = (process.env.RUNNER_CLI_BIN_DIRS ?? '')
    .split(':')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return {
    ...process.env,
    PATH: [ ...cliPathEntries, process.env.PATH ?? '' ].filter(Boolean).join(':')
  };
}
```

- [ ] **Step 2: Use that environment when spawning Codex and Claude commands**

```ts
const child = spawn(command, args, {
  cwd: options.cwd,
  shell: process.platform === 'win32',
  env: buildEnvWithCliPaths()
});
```

- [ ] **Step 3: Add a Linux-friendly runner image**

```dockerfile
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV RUNNER_CLI_BIN_DIRS=/opt/agent-cli/bin
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./
EXPOSE 4317
CMD ["node", "dist/main.js"]
```

- [ ] **Step 4: Document the Linux runner contract**

Update `runner/README.md` to state:

```md
- the container expects Codex/Claude CLI binaries to be present on PATH
- host admins can bind mount a CLI bin directory into `/opt/agent-cli/bin`
- `RUNNER_CLI_BIN_DIRS=/opt/agent-cli/bin` makes the runner discover them
- runner auth/config should live in a persistent Docker volume
```

- [ ] **Step 5: Verify the runner still builds**

Run:

```powershell
cd runner
npm run build
npm test
```

Expected: both commands pass.

### Task 2: Package the full app stack in Docker Compose for Linux

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`
- Modify: `.env.example`

- [ ] **Step 1: Add the runner service to the production compose file**

```yaml
  runner:
    build:
      context: ./runner
    restart: unless-stopped
    env_file:
      - .env
    environment:
      RUNNER_PORT: 4317
      RUNNER_SHARED_SECRET: ${RUNNER_SHARED_SECRET:-change-me}
      WORKSPACE_ROOT: /workspace-data
      RUNNER_CLI_BIN_DIRS: ${RUNNER_CLI_BIN_DIRS:-/opt/agent-cli/bin}
    volumes:
      - ./workspace-data:/workspace-data
      - runner_state:/runner-state
      - ${RUNNER_CLI_BIN_DIR:-/opt/agent-cli/bin}:/opt/agent-cli/bin:ro
    expose:
      - "4317"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:4317/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 10
```

- [ ] **Step 2: Point the backend at the compose runner service**

```yaml
    environment:
      HOST_RUNNER_URL: ${HOST_RUNNER_URL:-http://runner:4317}
      RUNNER_SHARED_SECRET: ${RUNNER_SHARED_SECRET:-change-me}
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
      runner:
        condition: service_healthy
```

- [ ] **Step 3: Keep dev hot-reload using the host runner**

```yaml
  backend:
    environment:
      HOST_RUNNER_URL: ${HOST_RUNNER_URL:-http://host.docker.internal:4317}
```

Dev compose should not force the Linux runner container path, because Windows hot-reload development still uses the host bridge.

- [ ] **Step 4: Add Linux runner env examples**

```env
HOST_RUNNER_URL=http://runner:4317
RUNNER_CLI_BIN_DIR=/opt/agent-cli/bin
RUNNER_CLI_BIN_DIRS=/opt/agent-cli/bin
```

- [ ] **Step 5: Verify compose syntax**

Run:

```powershell
docker compose config
docker compose -f docker-compose.yml -f docker-compose.dev.yml config
```

Expected: both commands render valid compose output without errors.

### Task 3: Keep backend runner resolution compatible with both host and container modes

**Files:**
- Modify: `backend/src/modules/runner/runner.service.ts`
- Modify: `backend/src/modules/runner/runner.service.spec.ts`

- [ ] **Step 1: Let the backend prefer `RUNNER_URL`, then fall back to `HOST_RUNNER_URL`**

```ts
const runnerUrl =
  this.config.get<string>('RUNNER_URL') ??
  this.config.get<string>('HOST_RUNNER_URL');
```

- [ ] **Step 2: Keep the existing shared-secret protection**

```ts
const sharedSecret = this.config.get<string>('RUNNER_SHARED_SECRET');
if (!runnerUrl || !sharedSecret) {
  throw new ServiceUnavailableException('Runner is not configured.');
}
```

- [ ] **Step 3: Update the runner service test fixture**

Adjust the spec so it covers both env var names and still expects a POST to `/jobs` with `x-runner-secret`.

- [ ] **Step 4: Run backend tests**

Run:

```powershell
cd backend
npm test
npm run build
```

Expected: both commands pass.

### Task 4: Update deployment docs and verify the stack end to end

**Files:**
- Modify: `README.md`
- Modify: `runner/README.md`

- [ ] **Step 1: Document the Linux compose path**

Add a deployment section showing:

```powershell
docker compose up --build
```

and explain that the runner is now a container in the production compose stack while Windows dev can still use the host runner override.

- [ ] **Step 2: Document the CLI mount contract**

Explain that the Linux runner expects the Codex/Claude CLI bin directory to be mounted into the container and exposed through `RUNNER_CLI_BIN_DIRS`.

- [ ] **Step 3: Verify the built images and compose wiring**

Run:

```powershell
cd frontend
npm run build
cd ..\backend
npm run build
cd ..\runner
npm run build
```

Then run:

```powershell
docker compose config
```

Expected: all builds succeed and compose renders a valid full-stack deployment.

