---
"homelab-dashboard-ui": patch
---

The 404 for a missing hashed asset no longer carries `Cache-Control: immutable, max-age=1y`, so a rollout race can no longer leave the browser with a 404 cached for a year.
