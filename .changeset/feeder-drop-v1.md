---
"interactive-map-feeder-api": minor
---

Drop the `/v1` prefix and the `src/v1` / `src/global` split

**Breaking:** routes move from `/v1/data-sources/...` to `/data-sources/...`, matching
every other API in the repo. The LaskaKit map firmware (`iot-esphome`) polls
`/data-sources/radar/cities/iot` and has to be reflashed with the new URL when this
deploys. `/health/*` is unchanged.

The OpenAPI document is renamed from `v1` to `api` (`SwaggerDocs.API`), like
`qr-manager-api` and `miot-bridge-api`.

Source layout is now flat — `controllers/`, `handlers/`, `endpoints/`, `services/`,
`providers/`, `health/`, `models/` (config models under `models/config/`) — the same
shape as the other APIs.
