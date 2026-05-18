# Codex Skilled Agent Guide

Use this file as the repo-level operating guide for Codex agents working in this project.

## Project Shape

- `frontend/`: Angular 21 standalone-component app with Bootstrap available and custom CSS in `src/styles.css`.
- `backend/`: NestJS API.
- `runner/`: trusted host runner bridge for local Codex and Claude CLI execution.
- `workspace-data/`: local workspaces and generated artifacts. Treat as runtime data.
- `.agents/skills/`: project skills when writable by the local environment.

## Working Rules

- Read the relevant app files before editing. Prefer the existing standalone Angular, signal, and OnPush patterns.
- Keep frontend changes focused on real app surfaces: login, app picker, workspace, files, editor, chat, jobs, and auth shell.
- Preserve API behavior unless the task explicitly asks for backend contract changes.
- Do not commit secrets. `.env`, runtime logs, generated workspace data, database volumes, and browser caches stay untracked.
- Use `rg` or `rg --files` for search.
- Use `npm run build` in the package being changed before claiming compile success.

## Frontend Direction

The current product direction is a dark, serious operator console for agent workspaces:

- dense but readable app shell
- charcoal panels on a dark neutral background
- crisp blue primary actions and selected states
- green, amber, and red status chips
- compact files/editor/chat/jobs workflow
- no marketing hero, decorative gradients, or placeholder-looking cards

## Validation

- Frontend build: `cd frontend; npm run build`
- Backend build/test commands should be checked in `backend/package.json` before use.
- Runner build/test commands should be checked in `runner/package.json` before use.
