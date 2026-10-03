---
"interactive-map-feeder-api": minor
"miot-bridge-api": minor
"qr-manager-api": minor
---

Leave CORS to the gateway: upgrade to `@radoslavirha/tsed-platform` 5.0.6

`BaseServer` no longer registers `cors()` (which reflected any origin with credentials) or
`methodOverride()`, so the APIs emit no `Access-Control-*` headers. CORS for
`qr-manager-api` comes from the Traefik headers middleware in `homelab`
(radoslavirha/homelab#10), which must be deployed before this release.

`BaseServer` now registers its middleware stack from its own `$beforeRoutesInit`, so the
`$beforeRoutesInit() { this.registerMiddlewares(); }` blocks in each `Server.ts` are gone.
The direct `cors` / `method-override` dependencies are removed.

Also picks up `@radoslavirha/tsed-logger` 0.7.3 (request logs no longer carry the raw
query string in `url`) and `@radoslavirha/tsed-swagger` 9.1.10.
