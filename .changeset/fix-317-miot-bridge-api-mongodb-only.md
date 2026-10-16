---
"miot-bridge-api": minor
---

Remove the local JSON file storage: MongoDB is the only storage. The `mongodb` config block is now required and must set `enabled: true`, so a missing or disabled block fails at boot. `cachePath` is ignored if still set.
