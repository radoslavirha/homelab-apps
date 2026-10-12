---
"miot-bridge-api": patch
---

Request validation is now strict: `null` or wrongly typed values (e.g. `{"deviceId": "442"}`) are rejected with 400 instead of being coerced.
