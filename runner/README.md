# Runner

The runner is a trusted execution bridge for app-specific jobs.

Linux deployment runs the runner inside Docker. The runner expects the approved CLI binaries to be available on `PATH`, either because they were installed into the image or because a host bind mount exposes them.

Recommended Linux container contract:

- set `RUNNER_CLI_HOST_BIN_DIR` in the host environment to the real CLI bin directory on the Linux machine
- mount that host path into `/opt/agent-cli/bin`
- set `RUNNER_CLI_BIN_DIRS=/opt/agent-cli/bin` inside the container
- keep auth/config state in a persistent Docker volume mounted at `/root`
- mount `workspace-data` so session folders and artifacts are shared with the backend
- start the stack with `docker compose --profile linux up --build`

Skill workflow:

- Keep app-specific skills in `runner/skills` for the image build.
- Sync installed marketplace or shared skills from `.codex/skills` and `.agents/skills` with `npm run sync:skills`.
- Rebuild the runner images after syncing so the new skills are baked into the container.

Security rules to preserve:

- Accept requests only from the backend using `RUNNER_SHARED_SECRET`.
- Never execute frontend-provided shell commands.
- Only read/write inside `workspacePath`.
- Keep command allowlists per provider.
- Stream or persist logs without leaking host secrets.
