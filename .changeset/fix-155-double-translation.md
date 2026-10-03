---
"@radoslavirha/tsed-http-provider": patch
---

A failed 401 auth replay is no longer translated twice, so the error keeps its status message and original Axios `origin`.
