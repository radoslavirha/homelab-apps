---
"miot-bridge-api": patch
---

MQTT command payloads are validated with a Zod schema instead of the Ts.ED `JSONSchemaValidator`. Accepted payloads are unchanged; the `error: Validation failed.` response now lists Zod issues instead of AJV errors.
