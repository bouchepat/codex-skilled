# Linux Packaging Design

## Goal

Package the full Codex Skilled stack for Linux deployment using Docker Compose:

- MySQL
- Redis
- NestJS backend
- Angular frontend
- runner service

The deployment should preserve the current product model:

- Firebase Google auth stays in the frontend/backend flow
- workspaces stay user-scoped by email slug
- sessions remain resumable by `session-id`
- market research stays locked to its allowed skills
- every report must produce a downloadable PDF artifact

## Scope

In scope:

- containerized Linux deployment for the full app stack
- runner packaged as a Linux container instead of a Windows host process
- compose networking between backend and runner
- persistent volumes for database, Redis, workspaces, and runner auth/config
- backend config updates for internal container URLs
- production-style deployment docs and validation steps

Out of scope:

- changing the app policy model
- changing session or workspace naming rules
- adding new apps or skills
- redesigning the frontend
- moving secrets management to a full orchestrator

## Proposed Architecture

The Linux deployment should use `docker-compose.yml` as the main production-style entry point.

### Services

- `mysql`: persistent relational database
- `redis`: queue backing store
- `backend`: NestJS API
- `frontend`: Angular app served from a container
- `runner`: Linux container that invokes the authenticated CLI tools

### Runtime boundaries

- `backend` communicates with `runner` over the compose network.
- `runner` mounts the workspace volume so it can read and write session folders and artifacts.
- `runner` also gets a persistent volume for CLI auth/config so restarts do not lose state.
- `frontend` talks to `backend` through the public API URL exposed in environment variables.

### Environment layout

- `workspace-data` remains a shared host-mounted volume for user artifacts.
- runner auth/config goes to a named Docker volume, not into the image layer.
- backend and frontend config keep using environment-driven injection.

## Runner Packaging Model

The runner becomes a Linux Docker image with its own Dockerfile.

The container should:

- run the runner service directly
- have access to the CLI binaries needed for Codex and Claude execution
- read approved skill docs from a mounted or copied skills directory
- write artifacts under the session workspace
- expose the runner health endpoint inside the compose network

Recommended implementation shape:

- keep the current runner codepath intact
- move Linux packaging to a dedicated runner image
- mount persistent auth/config for the CLI tools
- keep the runner isolated from the backend so app policy enforcement still happens in the backend first

## Data Flow

1. User logs in through Firebase in the frontend.
2. Backend creates or reuses the user workspace under the email-slug root.
3. User starts or resumes a session by `session-id`.
4. Backend enforces the app policy before enqueueing a job.
5. Runner receives the job and executes only the allowed app skills.
6. Runner writes markdown and PDF artifacts into the session folder.
7. Frontend shows the session history and artifact download links.

## Failure Handling

- If MySQL or Redis is unavailable, backend startup should wait for health checks instead of failing silently.
- If the runner is down, backend should surface a clear job submission failure.
- If a job completes without a PDF artifact, the job should be treated as failed for the market research app.
- If the runner loses CLI auth state, it should fail the job explicitly rather than falling back to an unauthenticated mode.

## Testing and Validation

Validation should cover:

- `docker compose up --build` starts the full stack on Linux
- backend can submit a market research job to the runner
- runner generates both markdown and PDF artifacts
- resumed sessions continue writing into the same `session-id` folder
- workspace paths remain scoped to the user's email slug
- app policy still rejects disallowed work outside market research

Recommended checks:

- container health checks
- backend integration test for runner submission
- runner smoke job through compose
- manual artifact download verification from the frontend

## Deployment Notes

- Linux deployment should be the canonical compose path for the full stack.
- The current Windows host runner remains a development convenience only until the Linux runner container is implemented and verified.
- The compose files should be kept compatible with the existing dev override so hot reload development still works on Windows.

## Open Decisions

- Which Linux base image the runner should use for the CLI toolchain
- Whether Codex and Claude auth state live in one shared runner volume or separate volumes
- Whether the runner image should bundle CLI binaries or install them at build time

