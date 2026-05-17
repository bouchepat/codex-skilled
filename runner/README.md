# Host Runner

The runner is a trusted host-side bridge. It exists outside Docker so it can use CLI sessions already authenticated on the host.

The current MVP implementation is a safe stub: it writes a markdown artifact into the mounted workspace. Replace `runAgentJob` with controlled Codex/Claude CLI invocations when ready.

Security rules to preserve:

- Accept requests only from the backend using `RUNNER_SHARED_SECRET`.
- Never execute frontend-provided shell commands.
- Only read/write inside `workspacePath`.
- Keep command allowlists per provider.
- Stream or persist logs without leaking host secrets.

