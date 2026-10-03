---
"miot-bridge-api": patch
---

Deleting a device now drops its pooled MiotDevice, so re-registering it with a new address or token no longer keeps talking to the old one.
