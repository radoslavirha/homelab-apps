---
"qr-manager-api": patch
---

GET /r/:slug now answers 503 when the Mongo lookup circuit is open and 504 when the lookup times out, instead of a generic 500.
