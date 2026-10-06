---
"@radoslavirha/miot-device": patch
---

MiotDevice and MiotTransport now default to a no-op logger when none is passed, as documented, instead of writing to the console. The unused `CONSOLE_LOGGER` export is removed; consumers relying on the old console output must pass their own `ILogger`.
