---
"@radoslavirha/miot-device": patch
---

Concurrent commands on one MiotDevice no longer reuse the same stamp; they are now run one after another.
