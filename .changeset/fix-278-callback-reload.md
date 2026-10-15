---
"@radoslavirha/ui-auth": patch
---

A failed sign-in callback no longer leaves a dead `code`/`state` in the address bar, so reloading lands on the sign-in page instead of failing again.
