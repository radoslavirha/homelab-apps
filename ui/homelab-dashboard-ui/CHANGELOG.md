# homelab-dashboard-ui

## 0.8.2

### Patch Changes

- [#128](https://github.com/radoslavirha/homelab-apps/pull/128) [`04d6ed1`](https://github.com/radoslavirha/homelab-apps/commit/04d6ed1ae1b510ee0508097c295f1310b122a919) Thanks [@radoslavirha](https://github.com/radoslavirha)! - The dashboard now reloads its DNS records once the Unifi controller recovers, instead of staying on the stale error until the page is reloaded.

- [#167](https://github.com/radoslavirha/homelab-apps/pull/167) [`cf53ef7`](https://github.com/radoslavirha/homelab-apps/commit/cf53ef7326d27d4e02f49447db9764c8a078b2a6) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Stop rendering empty subnet clusters when every host in a subnet is excluded in the fallback grouping.

- [#137](https://github.com/radoslavirha/homelab-apps/pull/137) [`ae60a7d`](https://github.com/radoslavirha/homelab-apps/commit/ae60a7dedd183d4506b9b3e6f7a8a8e66bf4cacf) Thanks [@radoslavirha](https://github.com/radoslavirha)! - The API status banner now reports an error when the Unifi proxy answers 200 with an unusable body instead of showing healthy.

- [#171](https://github.com/radoslavirha/homelab-apps/pull/171) [`505785a`](https://github.com/radoslavirha/homelab-apps/commit/505785a891722a4c340b198ce9b486024ec6a5b0) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Tiles for services named like an Object.prototype member (e.g. `constructor.home`) no longer get junk appended to their URL.

- [#149](https://github.com/radoslavirha/homelab-apps/pull/149) [`cf65da7`](https://github.com/radoslavirha/homelab-apps/commit/cf65da796489f63db770a01c0a7ffc9dee099021) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Config validation now rejects a `serverPattern` without a capture group instead of rendering all servers as one wrong cluster.

- [#154](https://github.com/radoslavirha/homelab-apps/pull/154) [`dfae600`](https://github.com/radoslavirha/homelab-apps/commit/dfae6006db2fc32b6233e57e1a3a9cb2c51074aa) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Keep retrying after a transient 404/408/429 from the controller proxy instead of staying on the error until reload.

- [#166](https://github.com/radoslavirha/homelab-apps/pull/166) [`377f057`](https://github.com/radoslavirha/homelab-apps/commit/377f057b977a7655df956c9d8a5b98cc20a1e727) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Dashboard keeps recovering from a failed load after a brief offline/online network blip instead of staying on the error.

- [#180](https://github.com/radoslavirha/homelab-apps/pull/180) [`e92f392`](https://github.com/radoslavirha/homelab-apps/commit/e92f39259b3787cc1a34d3fb71181ab4cbabf304) Thanks [@radoslavirha](https://github.com/radoslavirha)! - A `paths` suffix without a leading slash no longer corrupts the tile hostname; a missing `/` is added.

- [#188](https://github.com/radoslavirha/homelab-apps/pull/188) [`cf3c22c`](https://github.com/radoslavirha/homelab-apps/commit/cf3c22c75a0f463f2da05388f64f0417cc0d6e63) Thanks [@radoslavirha](https://github.com/radoslavirha)! - The browser tab title now follows `title` from config.json (default `Homelab dashboard`).

- [#199](https://github.com/radoslavirha/homelab-apps/pull/199) [`ae34740`](https://github.com/radoslavirha/homelab-apps/commit/ae347402fa72be9273751212e41855f56d7ac063) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - The nginx proxy now forwards only read requests for the static DNS endpoint with the UniFi API key; every other path and method under /proxy/network/ is refused.

- [#205](https://github.com/radoslavirha/homelab-apps/pull/205) [`63c4ce5`](https://github.com/radoslavirha/homelab-apps/commit/63c4ce5a615c136925051e50fe946a3590af3973) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - A rejected UniFi API key no longer shows a "sign in again" banner on the dashboard, which has no login.

- [#221](https://github.com/radoslavirha/homelab-apps/pull/221) [`d80aa53`](https://github.com/radoslavirha/homelab-apps/commit/d80aa533f332b821f87c1d9e415bb45918787275) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - Cluster headers now show the anchor's real hostname instead of a hard-coded "server<N>".

- [#222](https://github.com/radoslavirha/homelab-apps/pull/222) [`d8475fe`](https://github.com/radoslavirha/homelab-apps/commit/d8475feb2b4fac65f10a975514715d2cc5a11bbe) Thanks [@claude-agent-irha](https://github.com/apps/claude-agent-irha)! - A server numbered 0 now gets its own accent color instead of sharing server1's.

- [`824756b`](https://github.com/radoslavirha/homelab-apps/commit/824756b4d472000c8654370be46e29dba41be49c) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Update dependencies
- Updated dependencies [[`b00ffb9`](https://github.com/radoslavirha/homelab-apps/commit/b00ffb98c552cc7aa773556005049b2769fa5f18), [`824756b`](https://github.com/radoslavirha/homelab-apps/commit/824756b4d472000c8654370be46e29dba41be49c)]:
  - @radoslavirha/ui-runtime@0.3.1
  - @radoslavirha/ui-kit@1.1.1

## 0.8.1

### Patch Changes

- [#113](https://github.com/radoslavirha/iot-miniservers/pull/113) [`462a0e0`](https://github.com/radoslavirha/iot-miniservers/commit/462a0e0a7c91c803b727184c5b7acb698ba15c69) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Listen on IPv6 as well as IPv4
  
  Both nginx images now declare an explicit `listen [::]:<port> default_server;`
  alongside the existing IPv4 listener, in every `nginx.conf` and
  `nginx.conf.template`. Previously nginx only bound `0.0.0.0`, so `localhost`
  and `[::1]` failed inside the container even though the app answered fine on
  the pod's IPv4 address.
  
  Not a production defect today — the kubelet probes the pod IP, which is
  IPv4-only on these clusters — but it made the frontend health-check spec's own
  verification commands fail, and it would break liveness outright if a cluster
  ever becomes dual-stack. The base image's own
  `10-listen-on-ipv6-by-default.sh` cannot fix this: it patches the stock
  `default.conf` before our own template overwrites it via envsubst, so the
  listener has to be declared in our own config.

## 0.8.0

### Minor Changes

- [`836f322`](https://github.com/radoslavirha/iot-miniservers/commit/836f32235fbe936d0e292898190319a046874980) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Serve the UIs from nginx-unprivileged as UID 101 on port 8080
  
  Both images move from `nginx:1.29-alpine`, whose master process starts as root,
  to `nginxinc/nginx-unprivileged:1.29-alpine`. They were the last containers in
  the estate still running as root — the APIs have run as UID 1000 with an
  enforced `runAsNonRoot` since 0.13.0 / 0.25.0 / 0.8.0.
  
  **Breaking for deployment:** nginx now binds 8080, because a non-root process
  cannot bind a port below 1024. The Service `targetPort` in
  `homelab:gitops/helm-values` must move with the image — the two are one change,
  not two. Nothing else moves: the probe path is still `/healthz`, the entrypoint
  pipeline, its config validation and `STOPSIGNAL SIGQUIT` are unchanged, and
  `NGINX_BASE_PATH` still selects the sub-path.

## 0.7.0

### Minor Changes

- [`84a7d27`](https://github.com/radoslavirha/iot-miniservers/commit/84a7d2745a68192c132bd934dae7b869b871fdba) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Slim dockerfiles

## 0.6.0

### Minor Changes

- [#105](https://github.com/radoslavirha/iot-miniservers/pull/105) [`5352256`](https://github.com/radoslavirha/iot-miniservers/commit/5352256916a6d7081c2f605a04cb9ba14bce91f4) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Refactor homelab dashboard

## 0.5.1

### Patch Changes

- Updated dependencies [[`8eff9a3`](https://github.com/radoslavirha/iot-miniservers/commit/8eff9a3fc7c6aea685ad23d70158346f9c1903d6)]:
  - @radoslavirha/ui-runtime@0.3.0
  - @radoslavirha/ui-kit@1.1.0

## 0.5.0

### Minor Changes

- [`8b72e52`](https://github.com/radoslavirha/iot-miniservers/commit/8b72e52e20625d4261b9024f6e2d8300658a3906) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Move the UniFi API key out of the browser.
  
  `config.json` no longer carries `unifi.host` or `unifi.apiKey`; nginx attaches the credential to the
  proxied request with `proxy_set_header X-Api-Key`, reading `UNIFI_HOST` and `SECRET_UNIFI_API_KEY` from
  the environment. A new `10-require-unifi-env.sh` entrypoint guard fails the container fast if either is
  empty, replacing the coverage the validating initContainer loses.
  
  The runtime config contract changes, so this is a minor rather than a patch. The image itself stays
  compatible in both directions — Zod strips unknown keys, so it runs against a config.json that still
  carries the old `unifi.host` / `unifi.apiKey` as happily as one without them.

## 0.4.2

### Patch Changes

- [`8046bc5`](https://github.com/radoslavirha/iot-miniservers/commit/8046bc5e20911838609caef053f1a5d209c3cd82) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Update dependencies
- Updated dependencies [[`8046bc5`](https://github.com/radoslavirha/iot-miniservers/commit/8046bc5e20911838609caef053f1a5d209c3cd82)]:
  - @radoslavirha/ui-kit@1.0.1
  - @radoslavirha/ui-runtime@0.2.1

## 0.4.1

### Patch Changes

- [`c286c71`](https://github.com/radoslavirha/iot-miniservers/commit/c286c71d13b0675e51cb812eeb68a821600e4291) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Declare a numeric UID in the config-validator images.

  The validator stages used `USER node`. Kubernetes verifies `runAsNonRoot: true`
  against the image's configured user and cannot map a username to a UID — that
  mapping lives in the image's `/etc/passwd`, which the kubelet does not read — so
  it fails closed:

  ```text
  CreateContainerConfigError: container has runAsNonRoot and image has
  non-numeric user (node), cannot verify user is non-root
  ```

  This blocked the first `validate: true` sync on both sandbox clusters. `USER 1000`
  is the same user (`node` in `node:*-alpine`), stated in the form Kubernetes can
  verify, so the image satisfies `runAsNonRoot` without the chart having to supply
  `runAsUser`.

  No behaviour change outside Kubernetes: the validator still runs as uid 1000 and
  still works under a read-only root filesystem.

## 0.4.0

### Minor Changes

- [`85e81bf`](https://github.com/radoslavirha/iot-miniservers/commit/85e81bf0dd6e3b6f06d841a0f1f59a255e936fd8) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Release validator image for frontends

## 0.3.0

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

### Patch Changes

- Updated dependencies [[`09a3ba1`](https://github.com/radoslavirha/iot-miniservers/commit/09a3ba182730cf56a5a680e3784cb7bb85218722), [`09a3ba1`](https://github.com/radoslavirha/iot-miniservers/commit/09a3ba182730cf56a5a680e3784cb7bb85218722)]:
  - @radoslavirha/ui-kit@1.0.0
  - @radoslavirha/ui-runtime@0.2.0

## 0.2.2

### Patch Changes

- [`4a34a89`](https://github.com/radoslavirha/iot-miniservers/commit/4a34a892fa02d4d44307e756a9cab77c1e68256a) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Update packages

- Updated dependencies [[`4a34a89`](https://github.com/radoslavirha/iot-miniservers/commit/4a34a892fa02d4d44307e756a9cab77c1e68256a)]:
  - @radoslavirha/ui-kit@0.2.2

## 0.2.1

### Patch Changes

- [`422cfcf`](https://github.com/radoslavirha/iot-miniservers/commit/422cfcf17880bbd18b824b20592cac85e007ec88) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Update packages

- Updated dependencies [[`422cfcf`](https://github.com/radoslavirha/iot-miniservers/commit/422cfcf17880bbd18b824b20592cac85e007ec88)]:
  - @radoslavirha/ui-kit@0.2.1

## 0.2.0

### Minor Changes

- [`aeff188`](https://github.com/radoslavirha/iot-miniservers/commit/aeff188f97952da65227e41d36e7fec2626f8cb2) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Update dependencies

### Patch Changes

- Updated dependencies [[`aeff188`](https://github.com/radoslavirha/iot-miniservers/commit/aeff188f97952da65227e41d36e7fec2626f8cb2)]:
  - @radoslavirha/ui-kit@0.2.0

## 0.1.2

### Patch Changes

- [`a5bbc53`](https://github.com/radoslavirha/iot-miniservers/commit/a5bbc53ab986ad918f45dfd875d18021f4027443) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Fix nginx

## 0.1.1

### Patch Changes

- [`8bb6799`](https://github.com/radoslavirha/iot-miniservers/commit/8bb679916e23e64df4dd97643f1494e01ef710c2) Thanks [@radoslavirha](https://github.com/radoslavirha)! - Update packages

- Updated dependencies [[`8bb6799`](https://github.com/radoslavirha/iot-miniservers/commit/8bb679916e23e64df4dd97643f1494e01ef710c2)]:
  - @radoslavirha/ui-kit@0.1.1
