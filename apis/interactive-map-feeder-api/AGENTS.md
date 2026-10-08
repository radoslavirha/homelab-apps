# Instructions

- API end-user documentation lives in [README.md](./README.md), including the auth model and how a device gets its credential. Keep it up to date when adding or changing endpoints, config keys, or protocols — the `updating-docs` skill owns its format. Swagger UI is mounted at `/`.

## What it does

Fetches ČHMÚ precipitation radar imagery, composites it with `sharp` (radar, surface, city markers, borders) and returns per-city RGB LED values for the LaskaKit interactive map of the Czech Republic.

## Source layout beyond the root conventions

- `src/Cities.ts` — the fixed list of cities on the map (`id`, name, coordinates). The map device consumes the `id`s in every response; treat them as an external contract and never renumber.
- `src/DataSources.ts` — `DataSources` enum used in routes (`/data-sources/:dataSource/...`). Its lowercase value predates the enum rule and is part of the route contract.
- `endpoints/chmi/` — `ChmiPortalEndpoint` and `ChmiRadarEndpoint`; base URLs come from `externalApis` config (`ExternalApi` enum), not constants.
- `services/RasterService.ts` (sharp wrapper), `RadarImageService`, `RadarService` — image fetch and pixel → LED colour.
- `health/UpstreamHealthCheck.ts` — `critical: false` and reports `warn`, never `fail`: every dependency is third-party, so failing readiness would turn ČHMÚ's outage into ours.

## Rules

- One trust domain (`AuthMethod.Idp`), applied on the controller class. A device is another trusted issuer in config, not a new trust domain; restricting a route to a device is `@RequireRoles`, not authentication.
- Every route reads public data; there is no database and no secret in config.
