---
"miot-bridge-api": minor
---

Removed `GET /command` and `GET /command/raw`. Use `POST /command` and `POST /command/raw` with a JSON body, which keeps numeric and boolean values typed.
