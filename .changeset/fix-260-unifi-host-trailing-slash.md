---
"homelab-dashboard-ui": patch
---

A trailing slash on `UNIFI_HOST` no longer crash-loops nginx; a `UNIFI_HOST` with a path is refused with a clear message.
