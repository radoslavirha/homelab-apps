# miot-bridge-api — Architecture & Technical Reference

This document is for contributors and AI coding agents. For end-user documentation, see [README.md](./README.md) (generated from [.README.hbs](./.README.hbs)).

## Overview

miot-bridge-api is a Node.js API (Ts.ED framework) that bridges Loxone and other home-automation controllers to Xiaomi devices via the MIoT binary protocol. It exposes REST and MQTT command interfaces over a unified payload model, publishes notifications over MQTT, and manages device registration, MIoT spec caching, property polling, and notification subscriptions.

## Source structure

```
src/
├── controllers/        # Ts.ED HTTP controllers (CommandController, DevicesController, DeviceNotificationsController)
├── endpoints/
│   └── miot-spec-v2/   # External MIoT spec v2 HTTP fetch wrapper + DTO
├── handlers/           # Business logic per route action
│   └── notifications/  # Notification subscription CRUD handlers
├── mappers/            # Bi-directional DTO ↔ model transforms
├── miot/
│   └── packet/         # MIoT binary protocol packet encoding/decoding
├── models/             # Ts.ED schema models, enums, request/response types
│   ├── config/         # Zod config schemas (ConfigModel, MqttConfig, PollingConfig)
│   ├── miot-spec-v2/   # Raw MIoT spec v2 shape models
│   ├── notifications/  # Notification request/response models
│   └── simplified-miot-spec/  # Internal simplified property/action map
├── providers/          # Custom Ts.ED providers (MqttClientProvider)
├── services/           # Core services: command execution, polling, dispatch, storage, listeners
└── storage/            # Storage layer — MongoDB repositories + DTOs, one subfolder per entity
    ├── device-mongo/                    # Device repository
    ├── model-property-override-mongo/   # Model property override repository
    └── notification-mongo/              # Notification subscription repository
```

All controllers are mounted at `/` — there is no API version prefix in routes.

## MIoT binary protocol

Communication between the bridge and devices uses the [Xiaomi Mi Home Binary Protocol](https://github.com/OpenMiHome/mihome-binary-protocol/blob/master/doc/PROTOCOL.md) over UDP.

### Stamp management

Every MIoT packet carries a `Stamp` counter that the device increments after each call. The bridge:

1. Obtains the current stamp via a handshake packet.
2. Increments and includes the stamp on every subsequent packet.
3. If a data packet is rejected (stale stamp), performs an automatic handshake to refresh the stamp and retries the packet once.

Stamp state is maintained per-device in memory by `MiotDeviceClient`.

## MIoT spec v2

The bridge fetches the raw spec JSON for each device from `miot-spec.org` via `MiotSpecV2Endpoint`. `MiotSpecV2Mapper` + `SimplifiedMiotSpecV2Mapper` parse it into a simplified in-memory map where:

- **Key format**: `<service-type-suffix>:<property-or-action-type-suffix>`
  Examples: `vacuum:status`, `battery:battery-level`, `vacuum:start-sweep`
- **Value**: property access flags (`read`, `write`, `notify`), type, allowed values, IIDs (for wire encoding) — or action arguments/results for actions.

This map is used to validate commands and notification subscriptions at request time.

## Storage

MongoDB is the only storage, via `@radoslavirha/tsed-mongoose`. The `mongodb` config block is required and must be enabled: a missing or disabled block fails at boot.

Layering (bottom-up):

1. `src/storage/<entity>-mongo/dto/` — Mongoose documents (extend `BaseMongo`)
2. `src/storage/<entity>-mongo/` — repository class (`DeviceMongoRepository`, etc.), performs CRUD and returns DTOs
3. `src/mappers/Mongo*Mapper.ts` — document ↔ domain model
4. `src/services/DeviceStorageService.ts`, `NotificationStorageService.ts`, `ModelPropertyOverrideService.ts` — map repository DTOs to domain models; what handlers and services inject

Repositories return `null` for missing single-document results. Services convert to `undefined` where callers expect it.

Controller integration specs boot against a real MongoDB from `@tsed/testcontainers-mongo` (`globalSetup` in `vitest.config.ts`), so `pnpm test` needs Docker.

## Polling & notification dispatch

`DevicePropertyPollerService` (singleton, extends `EventEmitter`):

- Hydrates an in-memory subscription map from storage on startup.
- Runs a `setTimeout`-based loop at `polling.intervalMs`.
- Per-device back-off after `maxErrorCount` consecutive errors (`errorSkipCycles` cycles skipped).
- Emits `property:changed` events on value changes (or every cycle when `dispatchOnChange = false`).

`NotificationDispatchService` receives `property:changed` events (and direct observations from `DeviceCommandService` for `GetProperty` calls) and publishes them over MQTT when `mqtt.notifications.enabled`. MQTT is the only outbound notification transport; the HTTP POST and UDP datagram transports were removed.

Subscription state mutations (`addSubscriptions`, `removeSubscription`, `removeAllSubscriptions`) are called synchronously by the notification REST handlers after persisting to storage, keeping the in-memory cache consistent without a storage round-trip per tick.

## Transport listeners

- **HTTP**: standard Ts.ED/Express HTTP server on `server.httpPort`.

There is no inbound UDP listener. UDP is used only by the outbound MIoT client to the devices.
- **MQTT**: `MqttClientProvider` creates the `mqtt` client; `MqttListenerService` subscribes to the command topic and routes to `DeviceCommandService`.

## Design decisions

- **Single instance**: The bridge is deployed as a single `replicas: 1` pod. The poller holds in-memory state (`_subscriptions`, `_lastValues`, `_errorCounts`, `_skipCycles`) that cannot be shared across instances without a distributed lock or an extracted poller service. This is intentional — the target use case is monitoring a small number of local devices.
- **No API versioning in routes**: Controllers are mounted at `/` without a version prefix.
