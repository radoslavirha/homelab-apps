---
"@radoslavirha/miot-device": minor
---

Treat the miIO stamp as the device's clock (seconds since boot), not a per-call counter. `DeviceClock` stamps each packet with the last reading the device reported plus the whole seconds elapsed since, plus one, and re-bases on a response header that shows the device ahead. No more +1 per packet in `getProperties`. `callAction` now resolves with the device's answer (`ActionResult`: `code` and raw `result`). `StampState` is now the last clock reading and is aged by its `updatedAt` when restored; a reading with `updatedAt` 0 is ignored.
