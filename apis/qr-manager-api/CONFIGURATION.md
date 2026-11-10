# qr-manager-api — configuration

<!-- Generated from the configuration schema. Do not edit by hand. -->

The service reads one JSON document (the `config` library: `config/<NODE_ENV>.json`; in a cluster, the mounted ConfigMap). It is validated at boot, and an invalid document stops the service. Keys not listed here are ignored.

**Required** means the key must be present whenever its parent is. A key with a default may be left out.

## Sections

| Section | Required | Description |
| --- | --- | --- |
| [`server`](#server) | yes | Ts.ED server settings. Keys other than httpPort are passed to the Ts.ED server configuration unchanged. |
| [`serviceName`](#servicename) |  | Service name. Defaults to the name in package.json. |
| [`publicURL`](#publicurl) |  | Public URL of the service, with protocol, host and path, when it is served behind a reverse proxy. |
| [`mongodb`](#mongodb) | yes | MongoDB configuration. The QR Manager always persists records to MongoDB. |
| [`redirect`](#redirect) | yes | Public redirect configuration. |
| [`health`](#health) |  | Health endpoint configuration. |
| [`logger`](#logger) |  | Logger configuration. |
| [`otel`](#otel) |  | OpenTelemetry configuration. |
| [`auth`](#auth) | yes | Authentication configuration. |

## Minimal example

Only the required keys, with placeholder values. Everything else falls back to its default.

```json
{
  "server": {
    "httpPort": 0
  },
  "mongodb": {
    "enabled": false,
    "url": "<string>"
  },
  "redirect": {
    "baseURL": "<string>"
  },
  "auth": {
    "IDP": {
      "type": "bearer-jwt",
      "trustedIssuers": [
        {
          "name": "<string>",
          "issuer": "<string>",
          "audience": "<string>",
          "key": {
            "source": "value",
            "value": "<string>"
          }
        }
      ]
    }
  }
}
```

## server

Ts.ED server settings. Keys other than httpPort are passed to the Ts.ED server configuration unchanged.

Required.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `server.httpPort` | number | yes |  | HTTP port the server listens on. A numeric string (from an environment variable) is accepted. |

## serviceName

Service name. Defaults to the name in package.json.

Optional.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `serviceName` | string |  |  | Service name. Defaults to the name in package.json. |

## publicURL

Public URL of the service, with protocol, host and path, when it is served behind a reverse proxy.

Optional.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `publicURL` | string |  |  | Public URL of the service, with protocol, host and path, when it is served behind a reverse proxy. |

## mongodb

MongoDB configuration. The QR Manager always persists records to MongoDB.

Required.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `mongodb.enabled` | boolean | yes |  | Set to `false` to disable. Keys marked required are required only when this is `true`. |
| `mongodb.url` | string | yes |  | MongoDB connection URL. |
| `mongodb.connectionOptions` | object |  |  | Additional MongoDB connection options. |
| `mongodb.connectionOptions.user` | string |  |  | Username for auth. |
| `mongodb.connectionOptions.pass` | string |  |  | Password for auth. |

## redirect

Public redirect configuration.

Required.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `redirect.baseURL` | string | yes |  | Public base URL a scanner reaches, with no path of its own (e.g. http://qr.home). Combined with the generated slug to compose the URL encoded into each printed QR image. Deliberately does NOT include the /r prefix the redirect controller is mounted under: on qr.home a Traefik addPrefix middleware adds it, which is what keeps the printed URL short and the admin paths off that host. On a host without that middleware (the shared api.<domain>/iot/qr-manager route) the /r must be part of this value. Distinct from BaseConfig.publicURL (admin API URL) and from per-record targetURL (the actual redirect destination, stored in DB and free-form). |

## health

Health endpoint configuration.

Optional.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `health.checkTimeoutMs` | integer (≥ 1, ≤ 2147483647) |  | `2000` | Deadline per health check, in ms. A check that takes longer reports `fail` with detail `timeout`. Keep it below the readiness probe timeoutSeconds. |
| `health.cacheTtlMs` | integer (≥ 0) |  | `1000` | How long an evaluated result is reused, in ms, so concurrent and closely spaced probes share one evaluation. `0` disables reuse. |
| `health.exposeDetail` | boolean |  | `true` | When `false`, `GET /health` returns the status alone, without the per-check breakdown. |

## logger

Logger configuration.

Optional.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `logger.enabled` | boolean |  | `true` | Write logs at all. `false` silences every log call, application and HTTP request logs alike. |
| `logger.level` | `"fatal"` \| `"error"` \| `"warn"` \| `"info"` \| `"debug"` \| `"trace"` |  | `"info"` | Logging level. |
| `logger.requests` | object |  | `{}` | HTTP request logging: one entry per handled request under scope `HTTP_REQUEST`, written when the response finishes, with `reqId`, `method`, `url`, `status` and `duration` (ms). Status below 400 logs `info` "Request completed"; 400 and above logs `error` "Request failed" with the error fields. |
| `logger.requests.enabled` | boolean |  | `true` | Write one log entry per handled HTTP request. `false` stops request logging only; application log calls are unaffected. |
| `logger.requests.headers` | object |  |  | Request headers, logged as `headers`. Credential headers (`authorization`, `cookie`, `set-cookie`, `proxy-authorization`, `x-api-key`) are redacted by default; a configured `redactPaths` replaces that list, so `[]` logs them raw. |
| `logger.requests.headers.enabled` | boolean |  | `true` | Include this field in the output. `false` omits the field entirely; it never means logging it unredacted. |
| `logger.requests.headers.redactPaths` | array of string (non-empty) |  | `["authorization","cookie","[\"set-cookie\"]","[\"proxy-authorization\"]","[\"x-api-key\"]"]` | Path selectors whose values are replaced with `***` before the field is written: `token` (root key), `user.password` (nested path), `items.*.token` (wildcard), `["set-cookie"]` (bracket form, required for names that are not identifiers, such as ones with a hyphen). A configured list replaces the default; it is never merged with it, and `[]` redacts nothing. |
| `logger.requests.query` | object |  |  | Parsed query-string parameters, logged as `query`. The logged `url` never carries the query string. |
| `logger.requests.query.enabled` | boolean |  | `true` | Include this field in the output. `false` omits the field entirely; it never means logging it unredacted. |
| `logger.requests.query.redactPaths` | array of string (non-empty) |  | `[]` | Path selectors whose values are replaced with `***` before the field is written: `token` (root key), `user.password` (nested path), `items.*.token` (wildcard), `["set-cookie"]` (bracket form, required for names that are not identifiers, such as ones with a hyphen). A configured list replaces the default; it is never merged with it, and `[]` redacts nothing. |
| `logger.requests.request` | object |  |  | Request body, logged as `request`. Bodies with a text content type (none, `text/*`, JSON, XML, GraphQL, JavaScript, form-urlencoded, `+json`, `+xml`) are logged; any other body is logged as `[[ BINARY ]]`. |
| `logger.requests.request.enabled` | boolean |  | `true` | Include this field in the output. `false` omits the field entirely; it never means logging it unredacted. |
| `logger.requests.request.redactPaths` | array of string (non-empty) |  | `[]` | Path selectors whose values are replaced with `***` before the field is written: `token` (root key), `user.password` (nested path), `items.*.token` (wildcard), `["set-cookie"]` (bracket form, required for names that are not identifiers, such as ones with a hyphen). A configured list replaces the default; it is never merged with it, and `[]` redacts nothing. |
| `logger.requests.response` | object |  |  | Response body, logged as `response`, after the same Ts.ED serialisation the client receives, so `redactPaths` match wire names. A non-text content type is logged as `[[ BINARY ]]`; a body that cannot be serialised, as `[[ UNSERIALIZABLE ]]`. |
| `logger.requests.response.enabled` | boolean |  | `true` | Include this field in the output. `false` omits the field entirely; it never means logging it unredacted. |
| `logger.requests.response.redactPaths` | array of string (non-empty) |  | `[]` | Path selectors whose values are replaced with `***` before the field is written: `token` (root key), `user.password` (nested path), `items.*.token` (wildcard), `["set-cookie"]` (bracket form, required for names that are not identifiers, such as ones with a hyphen). A configured list replaces the default; it is never merged with it, and `[]` redacts nothing. |
| `logger.requests.stack` | boolean |  | `true` | Add `error_stack` to the entry of a failed request (status 400 or above) when the thrown value is an `Error` or has a string `message`. |
| `logger.requests.ignorePaths` | array of string |  | `["/health","/healthz"]` | Request paths that get no log entry. Each is a case-sensitive prefix matched on whole path segments against the path without its query string: `/health` matches `/health` and `/health/live`, not `/healthcheck`. A trailing slash is ignored, so `/` matches every path. |

## otel

OpenTelemetry configuration.

Optional.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `otel.debug` | boolean |  |  | Enable OTEL SDK debug logging via DiagConsoleLogger. |
| `otel.resourceAttributes` | map of name → string \| number \| boolean |  |  | Extra resource attributes on every span, metric and log record, e.g. `{ "deployment.environment.name": "production" }`. Values are strings, numbers or booleans. `service.name` and `service.version` are not allowed. |
| `otel.traces` | object |  |  | Trace export over OTLP/HTTP (batched). Omitted or disabled: no traces are exported. |
| `otel.traces.enabled` | boolean | yes |  | Set to `false` to disable. Keys marked required are required only when this is `true`. |
| `otel.traces.exporter` | object | yes |  | OTLP/HTTP exporter configuration. Required when traces are enabled. |
| `otel.traces.exporter.url` | string | yes |  | OTLP/HTTP exporter endpoint URL. |
| `otel.metrics` | object |  |  | Metric export over OTLP/HTTP (periodic). Omitted or disabled: no metrics are exported. |
| `otel.metrics.enabled` | boolean | yes |  | Set to `false` to disable. Keys marked required are required only when this is `true`. |
| `otel.metrics.exporter` | object | yes |  | OTLP/HTTP exporter configuration. Required when metrics are enabled. |
| `otel.metrics.exporter.url` | string | yes |  | OTLP/HTTP exporter endpoint URL. |
| `otel.logs` | object |  |  | Log record export over OTLP/HTTP (batched). Omitted or disabled: no log records are exported. |
| `otel.logs.enabled` | boolean | yes |  | Set to `false` to disable. Keys marked required are required only when this is `true`. |
| `otel.logs.exporter` | object | yes |  | OTLP/HTTP exporter configuration. Required when logs are enabled. |
| `otel.logs.exporter.url` | string | yes |  | OTLP/HTTP exporter endpoint URL. |

## auth

Authentication configuration.

Required.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `auth.IDP` | one of (see below) | yes |  | How callers of the routes guarded by this method are verified. |

### `auth.IDP`: one of 2

Pick the variant with `type`.

#### `auth.IDP` — `type: "bearer-jwt"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `auth.IDP.type` | `"bearer-jwt"` | yes |  | Verify a bearer JWT from the `Authorization` header. |
| `auth.IDP.trustedIssuers` | array of object (at least 1 item) | yes |  | Issuers whose tokens are accepted. At least one; each `issuer` at most once. A token is matched to a row by its `iss`. |
| `auth.IDP.trustedIssuers[].name` | string (non-empty) | yes |  | Label for this issuer in the boot log. Not matched against anything. |
| `auth.IDP.trustedIssuers[].issuer` | string (non-empty) | yes |  | Exact `iss` value to match, compared as a string. Never normalised: a trailing slash matters. |
| `auth.IDP.trustedIssuers[].audience` | string (non-empty) | yes |  | Audience (`aud`) this service answers to. Tokens minted for another audience are refused. |
| `auth.IDP.trustedIssuers[].key` | one of (see below) | yes |  | Key that verifies token signatures from this issuer. |
| `auth.IDP.trustedIssuers[].subjectKind` | `"human"` \| `"service"` \| `"device"` |  | `"human"` | Caller class that tokens from this issuer represent, stamped onto the principal. |
| `auth.IDP.trustedIssuers[].rolesClaim` | string |  | `"roles"` | Token claim the roles are read from. A token without it has no roles. |

##### `auth.IDP.trustedIssuers[].key`: one of 2

Pick the variant with `source`.

###### `auth.IDP.trustedIssuers[].key` — `source: "value"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `auth.IDP.trustedIssuers[].key.source` | `"value"` | yes |  | Inline key, carried in the configuration itself. |
| `auth.IDP.trustedIssuers[].key.algorithm` | string (non-empty) |  | `"HS256"` | Algorithm this key is for, and the only one accepted from this issuer. The `alg` in the token header is never trusted on its own. |
| `auth.IDP.trustedIssuers[].key.value` | string (non-empty) | yes |  | For `HS*`: the shared secret. Otherwise: a PEM-encoded public key. |

###### `auth.IDP.trustedIssuers[].key` — `source: "jwks"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `auth.IDP.trustedIssuers[].key.source` | `"jwks"` | yes |  | Keys fetched from a remote JWKS endpoint. |
| `auth.IDP.trustedIssuers[].key.uri` | string (uri) | yes |  | URL of the JWKS endpoint. |
| `auth.IDP.trustedIssuers[].key.auth` | `"none"` \| `"serviceAccountToken"` |  | `"none"` | Credential for the JWKS fetch itself. `serviceAccountToken` sends the pod's Kubernetes service account token, for the apiserver JWKS, which is not anonymously readable. |
| `auth.IDP.trustedIssuers[].key.algorithms` | array of string (non-empty) |  | `["RS256"]` | Signature algorithms accepted from this issuer (an allowlist). |
| `auth.IDP.trustedIssuers[].key.cacheTtlSeconds` | integer (> 0) |  | `300` | How long a fetched key set is reused, in seconds. |
| `auth.IDP.trustedIssuers[].key.refreshCooldownMs` | integer (> 0) |  | `30000` | Minimum time between two key set fetches, in ms, so tokens with an unknown `kid` cannot force a fetch per request. |
| `auth.IDP.trustedIssuers[].key.timeoutMs` | integer (> 0) |  | `3000` | Time limit for one JWKS fetch, in ms. |

#### `auth.IDP` — `type: "unauthenticated"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `auth.IDP.type` | `"unauthenticated"` | yes |  | No credential is checked: every request is admitted as one principal holding all of `roles`. Meant for testing without an IdP; the boot log warns about it. |
| `auth.IDP.roles` | array of string (non-empty) (at least 1 item) | yes |  | Roles every request is given. At least one. |
| `auth.IDP.defaultSubject` | string (pattern `^[\w.@+-]{1,150}$`) | yes |  | Subject of the principal when no usable `subjectHeader` value arrives. |
| `auth.IDP.subjectHeader` | string (non-empty) |  |  | Header whose value, when present and matching the subject pattern, becomes the subject (e.g. `X-User`). Unverified: a label for logs and attribution, never a basis for access. |
| `auth.IDP.subjectKind` | `"human"` \| `"service"` \| `"device"` |  | `"human"` | Caller class of the principal. |
