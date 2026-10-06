---
"@radoslavirha/miot-device": patch
---

MiotDevice and MiotTransport now default to a no-op logger when none is passed, as documented, instead of writing to the console. Consumers relying on the old console output must pass `CONSOLE_LOGGER` explicitly.
