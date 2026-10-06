# Instructions

- API end-user documentation lives in [README.md](./README.md). Keep it up to date when adding or changing endpoints, config keys, or protocols — the `updating-docs` skill owns its format. Swagger UI is mounted at `/`.
- Technical architecture reference lives in [DEVELOPMENT.md](./DEVELOPMENT.md).

## Source layout beyond the root conventions

- `filters/` — Ts.ED response filters (`CommandResponseFilter`).
- `providers/MqttClientProvider.ts` — the MQTT client as a DI token; tests replace it with `{ token: MqttClientProvider, use: null }`.
- `models/simplified-miot-spec/` — the internal property/action map built from the raw spec in `models/miot-spec-v2/`.
- `storage/` — one subfolder per backend + entity (`device-*`, `notification-*`, `model-property-override*`), each with its own `dto/`.
- The miIO binary protocol (packets, `Stamp`, handshake) lives in `packages/miot-device`, not here. That package has **no** OpenTelemetry dependency; the app instruments it from `src/otel/miotTracing.ts`.

## Miot protocol

Communication between API and device uses [Xiaomi Mi Home Binary Protocol (miot)](https://github.com/OpenMiHome/mihome-binary-protocol/blob/master/doc/PROTOCOL.md).

The tricky part is the packet `Stamp`: a counter the device increments after every call. The client must cache it and send the increased value on every call, or the device refuses. The current `Stamp` comes from a handshake; `MiotDevice` caches it and re-handshakes reactively when a command fails, then retries (`miot.stamp.refreshed` on the span).

## Miot spec

API guards possible commands for a device using [Miot spec](https://miot-spec.org/miot-spec-v2).
The spec service parses the raw JSON into Maps of properties and actions where:

- key is part of the service `type` string (vacuum, battery, …) plus part of the action/property `type` string (status, start-sweep, …)
- value is similar to the raw spec, with modified `iid` where `siid` is `service.iid`
  - `piid` is `property.iid` for properties
  - `aiid` is `action.iid` for actions

## Communication

API ↔ device is UDP (miIO). This is the only UDP in the service.
Client (Loxone) ↔ API is REST and MQTT inbound, MQTT outbound. No inbound UDP, no HTTP or UDP notifications.

Every protocol must accept and return the same payload.

## Coding rules

- Never use `any` type.
- Repositories return `null` (not `undefined`) for missing single-document results. Services convert to `undefined` where callers expect it.
