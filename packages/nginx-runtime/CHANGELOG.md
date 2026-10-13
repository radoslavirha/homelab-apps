# @radoslavirha/nginx-runtime

## 0.2.3

### Patch Changes

- [#256](https://github.com/radoslavirha/homelab-apps/pull/256) [`aa49525`](https://github.com/radoslavirha/homelab-apps/commit/aa495250a11b7c33f7a05c146bc39b3e38679fa4) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - The runtime-config guard now rejects configs that jq accepts but `JSON.parse` rejects (concatenated values, NaN/Infinity, leading zeros) and no longer misreports a top-level `null` or `false`.

## 0.2.2

### Patch Changes

- [`824756b`](https://github.com/radoslavirha/homelab-apps/commit/824756b4d472000c8654370be46e29dba41be49c) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Update dependencies

## 0.2.1

### Patch Changes

- [`8046bc5`](https://github.com/radoslavirha/iot-miniservers/commit/8046bc5e20911838609caef053f1a5d209c3cd82) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Update dependencies

## 0.2.0

### Minor Changes

- [`09a3ba1`](https://github.com/radoslavirha/iot-miniservers/commit/09a3ba182730cf56a5a680e3784cb7bb85218722) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Health check for frontends

- [`09a3ba1`](https://github.com/radoslavirha/iot-miniservers/commit/09a3ba182730cf56a5a680e3784cb7bb85218722) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Add health checks and runtime-config validation to the frontends.

  Both nginx images now expose an exact-match `/healthz` for the Kubernetes probes,
  shared from the new `@radoslavirha/nginx-runtime` package so the four nginx
  config files cannot drift.

  Each UI's runtime config is now described by a single Zod schema, used in two
  places from the same source file: the browser (`loadRuntimeConfig`) and a
  standalone validator bundle run as an initContainer before nginx starts. A
  config the app cannot use now fails the pod instead of producing a Ready pod
  serving a blank page.

  Behaviour changes worth noting on rollout:

  - The images no longer ship the development `public/config.json`. A ConfigMap
    that fails to mount is now a hard failure rather than silently serving
    localhost defaults.
  - `homelab-dashboard-ui` validates `unifi.apiKey`, which nothing checked before,
    and its `/healthz` is an exact match rather than a prefix.
  - `homelab-dashboard-ui` uses the stock nginx entrypoint pipeline instead of a
    custom `ENTRYPOINT`, restoring the base image's own init steps.
  - Both apps show a single banner when their backend is unreachable or failing,
    derived from real request outcomes. A 4xx does not raise it.
