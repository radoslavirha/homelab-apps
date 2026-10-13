---
"interactive-map-feeder-api": patch
---

Request validation is now strict: `?radius=null` and other wrongly typed query values are rejected with 400 instead of being coerced.
