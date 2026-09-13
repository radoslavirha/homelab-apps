# Distroless evaluation for the three Ts.ED API images

**Date:** 2026-09-13
**Scope:** `apis/qr-manager-api`, `apis/miot-bridge-api`, `apis/interactive-map-feeder-api`
**Status:** evaluated, built, run and verified locally. Changes left uncommitted for review.
**Base evaluated:** `gcr.io/distroless/nodejs24-debian12:nonroot`
(digest `sha256:14d42e2511532589a7c7e01a753667a74fcc96266e137e8125006b87b0c32d0a`)

---

## Verdict

**Worth doing.** Every hard constraint held, nothing broke, and the classic distroless traps
did not fire.

- 96MB off each image (-27%), with no change to build time — the `deps` and `build-*` stages
  are untouched, only the final `FROM` changes.
- OS attack surface drops from **79 dpkg packages to 10**. What is gone is everything an
  attacker with RCE would reach for first: `sh`, `bash`, `ls`, `cat`, `curl`, `wget`, `apt`,
  `dpkg`, the whole coreutils set.
- The OTel preload survives, and — this is the important part — **the way it can be got wrong
  fails loudly at startup, not silently**. See § "The OTel preload" below.
- CA certificates are present and `SSL_CERT_FILE` is already set, so outbound HTTPS works out
  of the box. This was the single most likely blocker and it is a non-issue.

There is exactly one cost that has to be paid deliberately, and it is not technical: **the UID
changes from 1000 to 65532, and the three `homelab` values files must change in the same
rollout.** See § "The homelab consequence".

---

## Measured sizes

Baselines rebuilt from this worktree's HEAD on 2026-09-13 so the comparison is apples-to-apples
(`docker images --format '{{.Size}}'`):

| Image | Before (`node:24-trixie-slim`) | After (distroless) | Delta |
| --- | ---: | ---: | ---: |
| `qr-manager-api` | 349MB | **253MB** | −96MB (−27.5%) |
| `miot-bridge-api` | 355MB | **260MB** | −95MB (−26.8%) |
| `interactive-map-feeder-api` | 363MB | **267MB** | −96MB (−26.4%) |
| *base layer alone* | `node:24-trixie-slim` 250MB | `distroless:nonroot` 154MB | −96MB |

The entire saving is the base layer; the app layer (~99–113MB of `dist` + prod `node_modules`)
is byte-for-byte identical. Nothing more is available here without attacking `node_modules`.

**Note on the 332/338/345MB figures.** Those come from `docs/README.md`, written during the
2026-09 slimming. Re-measuring the *unmodified* Dockerfile today gives 349/355/363MB — the
images have grown ~17MB from dependency drift since that line was written. The docs figure was
stale, not wrong at the time. `docs/README.md` has been corrected as part of this change.

---

## The OTel preload (highest-value check)

Distroless sets `ENTRYPOINT ["/nodejs/bin/node"]`, so `CMD` carries **node's argv**, not a
command line. The leading `node` word is dropped:

```dockerfile
CMD ["--import", "/home/app/dist/otel/instrument.js", "dist/index.js"]
```

### Verified, not assumed

1. **The preload is actually in the process argv.** From inside the running container:

   ```
   $ docker exec qr-distroless-boot /nodejs/bin/node \
       -e "console.log(require('fs').readFileSync('/proc/1/cmdline','utf8').split('\0').join(' '))"
   /nodejs/bin/node --import /home/app/dist/otel/instrument.js dist/index.js
   ```

2. **The SDK initialises before the app.** With `otel.debug: true`, the container logs the
   instrumentation patches being applied to core modules on the require hook — which only
   happens if `instrument.js` ran first:

   ```
   @opentelemetry/api: Registered a global for diag v1.9.1.
   @opentelemetry/instrumentation-http Applying instrumentation patch for nodejs core module on require hook { module: 'http' }
   @opentelemetry/instrumentation-express Applying instrumentation patch for module on require hook {
   @opentelemetry/instrumentation-winston Applying instrumentation patch for nodejs module file on require hook {
   @opentelemetry/instrumentation-mongoose Applying instrumentation patch for module on require hook {
   ```

3. **Spans actually reach an OTLP endpoint.** A throwaway HTTP sink on the host `:4318`, the
   container run with `--add-host=host.docker.internal:host-gateway` and a config adding
   `otel.traces.enabled: true` pointed at it. One request triggered into each app:

   ```
   SINK listening on 4318
   SINK POST /v1/traces bytes=7706     <- qr-manager-api
   SINK POST /v1/traces bytes=7702     <- miot-bridge-api
   SINK POST /v1/traces bytes=7702     <- miot-bridge-api (re-triggered with qr container removed,
                                          to prove the export was not qr's)
   ```

4. **`trace_id` is back in the logs** — the silent-failure symptom this whole check exists to
   catch. From the distroless `qr-manager-api` container:

   ```json
   {"level":"error","message":"Request failed","scope":"HTTP_REQUEST","method":"GET","url":"/qr-codes",
    "status":401,"trace_id":"1bb2ff11d50e526e29ea9bce935276df","span_id":"6aeeb456f9a229f9","trace_flags":"01"}
   ```

   and from `miot-bridge-api`: `"trace_id":"b0d5acbda53c941592278d0f3a240e1a"`.

### Negative control: what happens if someone forgets to drop `node`

This was the real worry — a silent regression. It is not silent. Built a deliberate-mistake
image (`FROM qr-manager-api:distroless` + the old `CMD ["node", "--import", ...]`) and ran it:

```
Error: Cannot find module '/home/app/node'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1456:15)
    ...
  code: 'MODULE_NOT_FOUND',
Node.js v24.14.0
```

The container exits immediately. In-cluster this is `CrashLoopBackOff` on the first rollout —
impossible to miss, and it never reaches a state where the app serves traffic without traces.
This is strictly *safer* than the current setup, where a dropped `--import` would leave a
healthy-looking pod exporting nothing.

---

## What else was verified

### It boots, read-only, with the real config mount

All three, run exactly as the cluster does
(`-e NODE_ENV=test -v <app>/config:/home/app/config:ro --read-only`):

| App | In-container port | Result |
| --- | --- | --- |
| `qr-manager-api` | 4002 | full Ts.ED route table, `qr-manager-api 0.8.1 is ready!`, started in 85ms |
| `miot-bridge-api` | 4001 | full route table (both `api` and `commands` OpenAPI versions), `miot-bridge-api 0.25.1 is ready!`, 86ms |
| `interactive-map-feeder-api` | 4000 | full route table, `interactive-map-feeder-api 0.13.1 is ready!`, 62ms |

`WORKDIR /home/app` and the `/home/app/config` mount point are unchanged, so the Helm chart's
rendered `config.json` lands where it always did:

```
$ docker exec qr-distroless-boot /nodejs/bin/node -e "console.log('uid',process.getuid(),'gid',process.getgid(),'cwd',process.cwd())"
uid 65532 gid 65532 cwd /home/app
```

### Health

From inside each container (no shell, so `node -e "fetch(...)"`):

```
qr-manager-api  → {"status":"pass","checks":{"mongodb":{"status":"pass","detail":"disabled"}}}
miot-bridge-api → {"status":"pass","checks":{"mongodb":{"status":"pass","detail":"disabled"},"mqtt":{"status":"pass","detail":"disabled"}}}
interactive-map-feeder-api → {"status":"pass","checks":{"upstream-apis":{"status":"pass"}}}
```

The `interactive-map-feeder-api` result is doing double duty: `upstream-apis: pass` means the
app's own HTTP client reached CHMI over TLS from inside the distroless container.

### Outbound TLS — the classic distroless trap did NOT fire

`gcr.io/distroless/nodejs24-debian12:nonroot` ships `/etc/ssl/certs/ca-certificates.crt` and
sets `SSL_CERT_FILE` to it in the image config. No extra layer needed:

```
$ docker exec miot-distroless /nodejs/bin/node \
    -e "fetch('https://miot-spec.org/miot-spec-v2/instances?status=all').then(r=>console.log('status',r.status))"
status 200

$ docker exec imf-distroless /nodejs/bin/node \
    -e "fetch('https://opendata.chmi.cz').then(r=>console.log('status',r.status))"
opendata.chmi.cz status 200
```

### `@swc/helpers` still a runtime dependency

```
$ docker exec qr-distroless-boot /nodejs/bin/node -e "console.log(require.resolve('@swc/helpers/package.json'))"
/home/app/node_modules/.pnpm/@swc+helpers@0.5.23/node_modules/@swc/helpers/package.json
```

Unchanged — the `pnpm deploy --prod` output is copied verbatim, only the base layer moved.

### hadolint

CI gates on `hadolint/hadolint-action@v3.1.0` against the root `Dockerfile`. The modified file
lints clean (exit 0, no findings). The `# hadolint ignore=DL3006` on the old `runtime-base` was
removed along with it — the new `FROM` is a pinned tag, not an unpinned `ARG`.

### UI and validator stages untouched

`qr-manager-ui`, `homelab-dashboard-ui` and both `*-config-validator` stages still build from
their own `FROM` lines (`nginxinc/nginx-unprivileged:1.29-alpine`, `node:24-alpine`). They never
referenced `runtime-base`, so the change does not reach them. `USER 101` / `USER 1000` there are
unaffected.

---

## Debuggability without a shell — tested, not asserted

The claim under test was "non-issue given OTel and kubectl access". Broadly it holds, with one
sharp edge that will bite the first person who hits it.

### The sharp edge: `node` is not on `PATH`

```
$ docker exec qr-distroless-boot node -e "console.log('hi')"
OCI runtime exec failed: exec failed: unable to start container process: exec: "node": executable file not found in $PATH

$ docker exec qr-distroless-boot /nodejs/bin/node -e "console.log('node', process.version)"
node v24.14.0
```

`PATH` in the image is the stock `/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`;
the binary lives at `/nodejs/bin/node`, which is not on it. **Every `kubectl exec` in a runbook
must be respelled** `kubectl exec <pod> -- /nodejs/bin/node -e '…'`. This is the one thing that
will trip people up, and it is why it is called out in the Dockerfile comment and `docs/README.md`.

Worth noting the same `docker exec` mechanism works fine — `kubectl exec` is not degraded, only
the spelling changes.

### What is actually gone

```
$ docker exec qr-distroless-boot sh -c "ls"
exec: "sh": executable file not found in $PATH
$ docker exec qr-distroless-boot ls
exec: "ls": executable file not found in $PATH
$ docker exec qr-distroless-boot cat /etc/passwd
exec: "cat": executable file not found in $PATH
$ docker exec qr-distroless-boot curl -s localhost
exec: "curl": executable file not found in $PATH
```

No `sh`, no `ls`, no `cat`, no `curl`, no `wget`, no `ps`, no package manager.

### `node -e` substitutes for each, verified

| Lost tool | Replacement | Verified output |
| --- | --- | --- |
| `ls` | `fs.readdirSync(p)` | `.swcrc AGENTS.md CHANGELOG.md … config deploy.json dist node_modules package.json src tsconfig.json` |
| `cat` | `fs.readFileSync(p,'utf8')` | printed `/home/app/config/test.json` |
| `curl` | `fetch(url)` | `{"status":"pass",…}` from `/health`; `200` from `https://miot-spec.org` |
| `whoami` / `pwd` | `process.getuid()` / `process.cwd()` | `uid 65532 gid 65532 cwd /home/app` |
| `ps` | `fs.readFileSync('/proc/1/cmdline','utf8')` | `/nodejs/bin/node --import /home/app/dist/otel/instrument.js dist/index.js` |

The substitutions are genuinely adequate. `fs` + `fetch` + `/proc` covers every diagnostic this
repo's runbooks actually perform. What you lose is *ergonomics* — piping, globbing, `grep`,
`tail -f` — not *capability*.

### Escape hatches, with exact commands

**1. The `:debug-nonroot` tag.** Verified to exist and to carry a full busybox:

```
$ docker image inspect gcr.io/distroless/nodejs24-debian12:debug-nonroot --format 'USER={{.Config.User}} ENTRYPOINT={{.Config.Entrypoint}}'
USER=65532 ENTRYPOINT=[/nodejs/bin/node]

$ docker run --rm gcr.io/distroless/nodejs24-debian12:debug-nonroot \
    -e "const d=require('fs').readdirSync('/busybox'); console.log('entries:',d.length,'has sh:',d.includes('sh'))"
entries: 382 has sh: true
```

Same UID, same entrypoint, 382 busybox applets at `/busybox`. To get a shell in a pinch, build
a throwaway image swapping the base and exec into it:

```sh
docker build --secret id=npmrc,src=/tmp/npmrc.auth --target qr-manager-api \
  --build-arg RUNTIME_FROM=gcr.io/distroless/nodejs24-debian12:debug-nonroot \
  -t qr-manager-api:debug .
kubectl exec -n <ns> deploy/qr-manager-api -- /busybox/sh
```

(That `--build-arg` needs a `ARG RUNTIME_FROM` added to the Dockerfile if you want it. It was
**not** added here — do not carry a debug base as a build knob into production unless the owner
wants it. Without it, `sed` the `FROM` line for the one-off build.)

**Careful:** plain `:debug` is `USER=0` (root), verified. Only `:debug-nonroot` keeps UID 65532.
Using `:debug` in-cluster fails `runAsNonRoot` admission.

**2. `kubectl debug` — the better option, no image rebuild:**

```sh
# ephemeral container sharing the pod's namespaces, with a real shell
kubectl debug -n <ns> <pod> -it --image=busybox:1.37 --target=<container> -- sh

# or a full copy of the pod with a debug base, leaving the original untouched
kubectl debug -n <ns> <pod> -it --copy-to=<pod>-debug --image=busybox:1.37 -- sh
```

`--target=<container>` shares the PID namespace so `/proc/1/...` and `ps` see the app process.
This needs no change to the image at all and is the recommended path.

---

## The homelab consequence — READ THIS BEFORE ROLLING OUT

**`gcr.io/distroless/nodejs24-debian12:nonroot` runs as UID/GID 65532, not 1000.** Confirmed
directly from the image config and from the running process (`uid 65532 gid 65532`).

The three API values files in the **`homelab`** repo currently pin:

```yaml
runAsUser: 1000
runAsGroup: 1000
fsGroup: 1000
```

at `gitops/helm-values/apps/<app>/base.yaml` for `qr-manager-api`, `miot-bridge-api` and
`interactive-map-feeder-api`.

**Those three files must change to 65532 in the same rollout as this Dockerfile.** Not before,
not after — the image and the chart have to move together.

If they are not changed, the pod does not start. The chart's `runAsUser: 1000` overrides the
image's `USER 65532`, the process runs as UID 1000 against a filesystem owned by 65532
(`COPY --chown=65532:65532`), and the container fails admission/startup with
**`CreateContainerConfigError`** — the same failure mode this repo already documented for
non-numeric `USER node`, reached by a different route. The pod never leaves `ContainerCreating`
and there is no application log to explain it.

**This repo was not edited to fix that, and the `homelab` repo was not touched** — per the
brief. It is stated here so the rollout is planned as one change across two repos.

Two further things to check in `homelab` before the rollout, which could not be verified from
here:

1. **Does any chart set `command:` or `args:` on these deployments?** If a chart pins
   `command: ["node", "--import", ...]` it overrides the image ENTRYPOINT+CMD and would keep
   working — but a chart that sets only `args:` would now be supplying node's argv and must
   likewise drop the `node` word. Grep for `command:`/`args:` in the three values files.
2. **Any runbook or alert annotation containing `kubectl exec … -- node`** needs respelling to
   `-- /nodejs/bin/node`.

---

## Things that did not break, but are worth knowing

### Node patch version regresses

`node:24-trixie-slim` currently ships **v24.17.0**; `gcr.io/distroless/nodejs24-debian12:nonroot`
ships **v24.14.0**. Distroless tracks Node a few patch releases behind the official images.
Three patch releases is not a security concern today, but it is a standing lag: distroless is
rebuilt on Google's cadence, not Node's, so a same-day patch for a Node CVE will land on
`node:24-*` first. Renovate manages `enabledManagers: [npm, github-actions]` only, so **this
`FROM` will not be bumped automatically** — same manual-bump situation as the pinned `jq` in the
nginx stages.

### The read-only-filesystem cache write is unchanged (pre-existing, not a regression)

`miot-bridge-api` writes device/notification/override JSON under `cachePath` (`./cache`,
resolved against `process.cwd()` = `/home/app`). Under `--read-only` that fails — on **both**
images identically:

```
distroless: WRITE FAILED: EROFS EROFS: read-only file system, mkdir '/home/app/cache'
slim:       WRITE FAILED: EROFS EROFS: read-only file system, mkdir '/home/app/cache'
```

In-cluster this is presumably served by a mounted volume; either way the distroless move does
not change it. Recorded only so it is not mistaken for a distroless regression if it surfaces.

### Build time and caching

Unchanged. `base`, `deps` and the three `build-*` stages still run on `node:24-trixie-slim` with
pnpm — only the final `FROM` moved. The `ARG BUILD_FROM` still drives the build stages; it no
longer drives `runtime-base`, which is now pinned directly. Rebuilds after a warm cache took
~2s per image.

---

## The change

### `Dockerfile`

```diff
-# USER is numeric, NOT `node`. Kubernetes verifies runAsNonRoot against the image's
-# configured user and cannot map a username to a UID — that mapping lives in the
-# image's /etc/passwd, which the kubelet does not read. With `USER node` it fails
-# closed: CreateContainerConfigError "container has runAsNonRoot and image has
-# non-numeric user (node), cannot verify user is non-root". 1000 is the node user in
-# node:24-trixie-slim.
-# hadolint ignore=DL3006
-FROM $BUILD_FROM AS runtime-base
+# Google distroless, NOT node:24-trixie-slim: no shell, no package manager, no libc
+# tooling — 10 dpkg packages instead of 79 (measured, 2026-09-13). Everything the app
+# needs at runtime is the node binary, glibc and libssl, and that is all this carries.
+#
+# Three things about this base are load-bearing:
+#
+#  1. ENTRYPOINT is already ["/nodejs/bin/node"], so CMD carries *arguments to node*,
+#     not a command line. The `node` word is dropped from every CMD below; the
+#     `--import .../instrument.js` preload has to survive that move or traces and
+#     every trace_id in the logs silently stop.
+#  2. USER is 65532 (nonroot), not 1000. It is numeric, which is what Kubernetes
+#     needs to verify runAsNonRoot — the kubelet does not read the image's
+#     /etc/passwd, so a named user fails closed with CreateContainerConfigError.
+#     The three charts in the homelab repo pin runAsUser/runAsGroup/fsGroup 1000 and
+#     MUST move to 65532 in the same rollout.
+#  3. `node` is not on PATH (it lives at /nodejs/bin/node) and there is no shell, so
+#     `kubectl exec -- node -e ...` must be spelled `-- /nodejs/bin/node -e ...`.
+#
+# The image already ships /etc/ssl/certs/ca-certificates.crt and sets SSL_CERT_FILE,
+# so outbound HTTPS (miot-spec.org, CHMI) works without adding a ca-certificates layer.
+FROM gcr.io/distroless/nodejs24-debian12:nonroot AS runtime-base

 LABEL maintainer="radoslav.irha@gmail.com"
 ENV LANG=C.UTF-8 \
     NODE_ENV=production
 WORKDIR /home/app
-USER 1000
+USER 65532
```

and, for each of the three API stages (`interactive-map-feeder-api`, `miot-bridge-api`,
`qr-manager-api`):

```diff
-COPY --from=build-<app> --chown=1000:1000 /prod/<app> /home/app
-CMD ["node", "--import", "/home/app/dist/otel/instrument.js", "dist/index.js"]
+COPY --from=build-<app> --chown=65532:65532 /prod/<app> /home/app
+# No `node` here: the distroless ENTRYPOINT is the node binary, CMD is its argv.
+CMD ["--import", "/home/app/dist/otel/instrument.js", "dist/index.js"]
```

Nothing else in the file changes. `base`, `deps`, all three `build-*` stages, both UI stages and
both validator stages are byte-identical.

### `docs/README.md`

The "Image rules" list said `USER 1000` / `--chown=1000:1000`, which would now be wrong, and the
size reference point was stale. Updated: the new base and UID, the "CMD is node's argv" rule, the
`/nodejs/bin/node` exec spelling, and 462MB → 349MB → 253MB.

---

## Reproducing this

```sh
set -a && . ./.env && set +a
printf '@radoslavirha:registry=https://npm.pkg.github.com/\n//npm.pkg.github.com/:_authToken=%s\n' \
  "$NODE_AUTH_TOKEN" > /tmp/npmrc.auth && chmod 600 /tmp/npmrc.auth

docker build --secret id=npmrc,src=/tmp/npmrc.auth --target qr-manager-api -t qr-manager-api:distroless .

# boots, read-only, with the app's own config
docker run --rm -e NODE_ENV=test -v "$PWD/apis/qr-manager-api/config:/home/app/config:ro" \
  --read-only qr-manager-api:distroless

# health / outbound TLS / filesystem, from inside (no shell — absolute node path)
docker exec <c> /nodejs/bin/node -e "fetch('http://127.0.0.1:4002/health').then(r=>r.text()).then(console.log)"
docker exec <c> /nodejs/bin/node -e "fetch('https://miot-spec.org').then(r=>console.log(r.status))"
docker exec <c> /nodejs/bin/node -e "console.log(require('fs').readdirSync('/home/app').join(' '))"

# traces: throwaway sink on :4318 that logs `${req.method} ${req.url}` and returns {}
#   config/test.json + "otel": {"debug": true, "traces": {"enabled": true,
#     "exporter": {"url": "http://host.docker.internal:4318/v1/traces"}}}
docker run -d -e NODE_ENV=test --add-host=host.docker.internal:host-gateway \
  -v "<temp config dir>:/home/app/config:ro" --read-only -p 14002:4002 qr-manager-api:distroless
curl -s localhost:14002/qr-codes   # any request; the sink should log POST /v1/traces
```

---

## Recommendation

Ship it, as one coordinated change across both repos:

1. This `Dockerfile` + `docs/README.md` change in `iot-miniservers`.
2. `runAsUser` / `runAsGroup` / `fsGroup` → `65532` in the three
   `gitops/helm-values/apps/<app>/base.yaml` files in `homelab`.
3. First sync to `sandbox` only, and confirm on the first pod: it reaches Ready, `/health`
   returns `pass`, and a trace with a `trace_id` shows up in Tempo. The trace check is the one
   that cannot be inferred from the pod being green.

Do not split 1 and 2 across separate rollouts.
