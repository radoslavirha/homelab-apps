---
"miot-bridge-api": patch
---

POST /devices and POST /devices/discover now reject a device token that is not 32 hex characters with 400 instead of registering a device that can never be controlled.
