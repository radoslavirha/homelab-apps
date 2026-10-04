---
"qr-manager-api": patch
"miot-bridge-api": patch
---

Requests with a malformed MongoDB `:id` now return 404 instead of an unhandled `CastError`.
