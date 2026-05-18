---
name: codex-skilled-project
description: Use when working in the Codex Skilled repository, especially for Angular frontend UI, NestJS backend API, runner integration, Docker compose setup, workspace files, Firebase auth, or project-specific agent workflow changes.
---

# Codex Skilled Project

Follow the root `AGENTS.md` first. This skill adds project-specific reminders for repeat work.

## Stack

- Frontend: Angular 21 standalone components, signals, `ChangeDetectionStrategy.OnPush`, Bootstrap CSS plus `src/styles.css`.
- Backend: NestJS API with Prisma/MySQL and Redis/BullMQ jobs.
- Runner: host bridge for authenticated local Codex and Claude CLI execution.
- Auth: Firebase Google login.

## Frontend Workflow

1. Preserve current API service contracts in `frontend/src/app/shared/api.service.ts` unless backend changes are requested.
2. Prefer local signals and `computed()` for component state.
3. Keep controls code-native and accessible.
4. For UI work, use the dark operator-console direction from `AGENTS.md`.
5. Run `npm run build` from `frontend/` after TypeScript or template changes.

## Runtime Data

Do not treat `workspace-data/`, logs, `.browser-use*`, `.venv*`, database volumes, or `.env` as source files.
