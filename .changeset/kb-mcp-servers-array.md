---
"knowledge-base-mcp": minor
---

**Breaking config change:** `mcpServers` is now a list of endpoints instead of a map keyed by `UPPER_SNAKE_CASE` names. Each entry's `name` identifies the endpoint in logs, refusals and auth, and must be unique, like `path`. The old map shape is refused at boot, so the homelab values must switch to the list in the same deploy.
