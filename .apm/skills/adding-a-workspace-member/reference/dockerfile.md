# Root Dockerfile rules

Read before adding stages for a new app or editing any existing stage. The comments in the
`Dockerfile` carry the same reasons next to the lines they explain.

## API stages

Copy the two `qr-manager-api` stages (`build-<name>` from `deps`, then `<name>` from
`runtime-base`) verbatim and change the name.

| Rule | Why it is not cosmetic |
| --- | --- |
| Final stage is `FROM runtime-base`, never `FROM base` | `base` carries a global pnpm install. A package manager in a running pod is attacker tooling. `runtime-base` is distroless — no shell, no package manager. |
| `CMD` carries node's **arguments**, not a command line | The distroless ENTRYPOINT is already the node binary. Repeating `node` fails instantly with `Cannot find module '/home/app/node'`. |
| `CMD` keeps `--import /home/app/dist/otel/instrument.js` | Dropping it silently removes every trace and every `trace_id` from logs. Nothing fails; the data just stops. |
| Never add `USER`, `WORKDIR` or `ENV NODE_ENV` to an app stage | `runtime-base` sets all three (`USER 65532`, `/home/app`, production). Re-declaring them is how they drift apart. |
| `COPY --from=build-<app> --chown=65532:65532` | Without the chown the files land as root. 65532 is distroless's `nonroot`; the homelab values pin the same UID. |
| Build-only packages (`typescript`, `@swc/cli`, `@swc-node/register`) in `devDependencies` | `pnpm deploy --prod` copies `dependencies` into the image. A compiler there is shipped, not used. |
| **`@swc/helpers` stays in `dependencies`** | `.swcrc` sets `externalHelpers: true`, so compiled output imports it at runtime. |
| `.swcrc` keeps `sourceMaps: false`; the build keeps `--ignore '**/*.spec.ts'` | Otherwise `dist/` ships source maps and compiled tests. |
| The npm token arrives only as `--mount=type=secret,id=npmrc` | An `ARG` or `ENV` token is readable forever in `docker history`. |

Debugging a running pod: there is no shell and `node` is not on `PATH` —
`kubectl exec <pod> -- /nodejs/bin/node -e '…'`, or `kubectl debug --image=busybox --target=<container>`.

## UI stages

Copy the four `qr-manager-ui` stages (`build-<name>`, `<name>`, `build-<name>-validator`,
`<name>-config-validator`) and change the name. Keep what they encode:

- `nginxinc/nginx-unprivileged` base, port 8080, numeric `USER 101` (Kubernetes cannot verify `runAsNonRoot` against a user name).
- The `nginx-runtime` healthz snippet and `05-validate-runtime-config.sh` entrypoint.
- No `config.json` in `dist/` — `vite.config.ts` sets `copyPublicDir: false`.
- The validator stage is named exactly `<name>-config-validator`: `docker-build-app.yaml` detects it by that name and publishes the second image the chart's initContainer runs.

## Not enforced by CI, deliberately

One Dockerfile, few hands — a CI gate that can fail for its own reasons on every PR is not worth
it. Do not add one without asking. The backstop is the cluster: pods run with `runAsNonRoot` and
a read-only root filesystem, so an image that regains root fails admission.

Spot-check an API image by hand when you touch any rule above. The image has no shell, so list
its filesystem with `docker export` instead of running commands in it:

```bash
docker build --target <name> --secret id=npmrc,src=$HOME/.npmrc -t <name>:check .
docker inspect <name>:check --format '{{.Config.User}}'                      # 65532 (UI images: 101)
id=$(docker create <name>:check)
docker export "$id" | tar -t \
  | grep -E '^home/app/(dist/.*\.(map|spec\.js)$|node_modules/(\.pnpm/)?(typescript|@swc\+cli|pnpm)[@/])'
docker rm "$id"
```

The `grep` must print nothing. A hit under `node_modules` means a build-only package reached
`dependencies` — directly or through a dependency — and `pnpm why <pkg> --prod` in the app says
which.
