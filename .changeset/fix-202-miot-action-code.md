---
"@radoslavirha/miot-device": patch
---

callAction now rejects with a device_error when the device refuses the action (non-zero result code) instead of reporting success
