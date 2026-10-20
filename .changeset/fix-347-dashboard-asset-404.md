---
"homelab-dashboard-ui": patch
---

A missing hashed asset now answers 404 and index.html is served with Cache-Control: no-cache, so a reload after a deploy no longer shows a blank page.
