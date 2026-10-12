---
"qr-manager-api": patch
---

Request validation is now strict: `null` or wrongly typed values (e.g. `{"active": null}`, `?active=foo`) are rejected with 400 instead of being coerced.
