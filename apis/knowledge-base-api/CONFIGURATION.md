# knowledge-base-api — configuration

<!-- Generated from the configuration schema. Do not edit by hand. -->

The service reads one JSON document (the `config` library: `config/<NODE_ENV>.json`; in a cluster, the mounted ConfigMap). It is validated at boot, and an invalid document stops the service. Keys not listed here are ignored.

**Required** means the key must be present whenever its parent is. A key with a default may be left out.

## Sections

| Section | Required | Description |
| --- | --- | --- |
| [`server`](#server) | yes | Ts.ED server settings. Keys other than httpPort are passed to the Ts.ED server configuration unchanged. |
| [`serviceName`](#servicename) |  | Service name. Defaults to the name in package.json. |
| [`publicURL`](#publicurl) |  | Public URL of the service, with protocol, host and path, when it is served behind a reverse proxy. |
| [`externalApis`](#externalapis) | yes | External APIs this service calls — base URL, auth, resilience and logging per API. |
| [`database`](#database) | yes | The Postgres database this service owns: schema, index and search. |
| [`github`](#github) |  | GitHub credentials — an App or a token — for every knowledge base with source GIT that has no `git.github` of its own. |
| [`embeddings`](#embeddings) |  | Embedding models served by Ollama. |
| [`knowledgeBases`](#knowledgebases) | yes | Every knowledge base this service indexes and serves. |
| [`indexer`](#indexer) |  | The background indexing loop. |
| [`search`](#search) |  | Hybrid search tuning. |
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
  "externalApis": {
    "OLLAMA": {
      "baseURL": "https://example.com"
    },
    "OLLAMA_SEARCH": {
      "baseURL": "https://example.com"
    }
  },
  "database": {
    "host": "<string>",
    "database": "<string>",
    "user": "<string>",
    "password": "<string>"
  },
  "knowledgeBases": [
    {
      "id": "<string>",
      "readers": [
        "<string>"
      ],
      "source": "GIT"
    }
  ],
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

## externalApis

External APIs this service calls — base URL, auth, resilience and logging per API.

Required.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA` | object | yes |  | One external API: base URL, auth, resilience and outbound logging. |
| `externalApis.OLLAMA.baseURL` | string (uri) | yes |  | Base URL every request path is resolved against. |
| `externalApis.OLLAMA.auth` | one of (see below) |  |  | How requests to this API are authenticated. Pick the variant with `strategy`; without `strategy` no credential is produced. |
| `externalApis.OLLAMA.resilience` | object |  |  | Timeout, retry and circuit breaker for requests to this API. Omit to send requests without them. |
| `externalApis.OLLAMA.resilience.timeout` | object |  |  | Per-attempt timeout. Omit to disable. |
| `externalApis.OLLAMA.resilience.timeout.ms` | integer (≥ 0) |  | `5000` | Time limit for one attempt, in ms. When it runs out the attempt is aborted through its AbortSignal and rejects. |
| `externalApis.OLLAMA.resilience.retry` | object |  |  | Retry policy. Omit to disable. Retries wrap the circuit breaker and the timeout, so each attempt gets its own timeout. |
| `externalApis.OLLAMA.resilience.retry.count` | integer (≥ 0) |  | `0` | Additional attempts after the first one. `0` disables retry. |
| `externalApis.OLLAMA.resilience.retry.backoffMs` | integer (≥ 0) |  | `250` | Constant delay between attempts, in ms. |
| `externalApis.OLLAMA.resilience.circuitBreaker` | object |  |  | Sampling circuit breaker. Omit to disable; `{}` enables it with the defaults. |
| `externalApis.OLLAMA.resilience.circuitBreaker.halfOpenAfterMs` | integer (≥ 0) |  | `10000` | How long the circuit stays open, in ms, before one trial call is let through (half-open). |
| `externalApis.OLLAMA.resilience.circuitBreaker.threshold` | number (> 0, < 1) |  | `0.5` | Error ratio over the sampling window above which the circuit opens. |
| `externalApis.OLLAMA.resilience.circuitBreaker.samplingDurationMs` | integer (≥ 1) |  | `10000` | Length of the trailing window the error ratio is measured over, in ms. |
| `externalApis.OLLAMA.resilience.circuitBreaker.minimumThroughput` | integer (≥ 1) |  | `5` | Calls per second the window must average before the circuit may open at all. |
| `externalApis.OLLAMA.retriableStatusCodes` | array of integer |  | `[500,502,503,504]` | HTTP statuses counted as transient failures, for retry and for the circuit breaker. |
| `externalApis.OLLAMA.logging` | object |  | `{"enabled":true,"headers":{"enabled":false,"redactPaths":[]},"query":{"enabled":false,"redactPaths":[]},"request":{"enabled":false,"redactPaths":[]},"response":{"enabled":false,"redactPaths":[]},"stack":false}` | Outbound request logging. Metadata only by default; each payload section is opt-in and redacted before it reaches the logger. |
| `externalApis.OLLAMA.logging.headers` | object |  |  | Request headers. The names of the transport headers the auth config sends are always added to `redactPaths`. |
| `externalApis.OLLAMA.logging.headers.enabled` | boolean |  | `false` | Log this section. Off unless switched on. |
| `externalApis.OLLAMA.logging.headers.redactPaths` | array of string (non-empty) |  | `["authorization","Authorization","cookie","Cookie","[\"set-cookie\"]","[\"proxy-authorization\"]","[\"x-api-key\"]"]` | Paths whose values are censored before logging (`fast-redact` syntax; hyphenated names in bracket notation, e.g. `["x-api-key"]`). |
| `externalApis.OLLAMA.logging.query` | object |  |  | Query parameters. The names of the transport query parameters the auth config sends are always added to `redactPaths`. |
| `externalApis.OLLAMA.logging.query.enabled` | boolean |  | `false` | Log this section. Off unless switched on. |
| `externalApis.OLLAMA.logging.query.redactPaths` | array of string (non-empty) |  | `[]` | Paths whose values are censored before logging (`fast-redact` syntax; hyphenated names in bracket notation, e.g. `["x-api-key"]`). |
| `externalApis.OLLAMA.logging.request` | object |  |  | Request body. |
| `externalApis.OLLAMA.logging.request.enabled` | boolean |  | `false` | Log this section. Off unless switched on. |
| `externalApis.OLLAMA.logging.request.redactPaths` | array of string (non-empty) |  | `[]` | Paths whose values are censored before logging (`fast-redact` syntax; hyphenated names in bracket notation, e.g. `["x-api-key"]`). |
| `externalApis.OLLAMA.logging.response` | object |  |  | Response body. |
| `externalApis.OLLAMA.logging.response.enabled` | boolean |  | `false` | Log this section. Off unless switched on. |
| `externalApis.OLLAMA.logging.response.redactPaths` | array of string (non-empty) |  | `[]` | Paths whose values are censored before logging (`fast-redact` syntax; hyphenated names in bracket notation, e.g. `["x-api-key"]`). |
| `externalApis.OLLAMA.logging.enabled` | boolean |  | `true` | Log outbound requests. `false` turns the logging off entirely. |
| `externalApis.OLLAMA.logging.stack` | boolean |  | `false` | Include the error stack when a request fails. |
| `externalApis.OLLAMA_SEARCH` | object | yes |  | One external API: base URL, auth, resilience and outbound logging. |
| `externalApis.OLLAMA_SEARCH.baseURL` | string (uri) | yes |  | Base URL every request path is resolved against. |
| `externalApis.OLLAMA_SEARCH.auth` | one of (see below) |  |  | How requests to this API are authenticated. Pick the variant with `strategy`; without `strategy` no credential is produced. |
| `externalApis.OLLAMA_SEARCH.resilience` | object |  |  | Timeout, retry and circuit breaker for requests to this API. Omit to send requests without them. |
| `externalApis.OLLAMA_SEARCH.resilience.timeout` | object |  |  | Per-attempt timeout. Omit to disable. |
| `externalApis.OLLAMA_SEARCH.resilience.timeout.ms` | integer (≥ 0) |  | `5000` | Time limit for one attempt, in ms. When it runs out the attempt is aborted through its AbortSignal and rejects. |
| `externalApis.OLLAMA_SEARCH.resilience.retry` | object |  |  | Retry policy. Omit to disable. Retries wrap the circuit breaker and the timeout, so each attempt gets its own timeout. |
| `externalApis.OLLAMA_SEARCH.resilience.retry.count` | integer (≥ 0) |  | `0` | Additional attempts after the first one. `0` disables retry. |
| `externalApis.OLLAMA_SEARCH.resilience.retry.backoffMs` | integer (≥ 0) |  | `250` | Constant delay between attempts, in ms. |
| `externalApis.OLLAMA_SEARCH.resilience.circuitBreaker` | object |  |  | Sampling circuit breaker. Omit to disable; `{}` enables it with the defaults. |
| `externalApis.OLLAMA_SEARCH.resilience.circuitBreaker.halfOpenAfterMs` | integer (≥ 0) |  | `10000` | How long the circuit stays open, in ms, before one trial call is let through (half-open). |
| `externalApis.OLLAMA_SEARCH.resilience.circuitBreaker.threshold` | number (> 0, < 1) |  | `0.5` | Error ratio over the sampling window above which the circuit opens. |
| `externalApis.OLLAMA_SEARCH.resilience.circuitBreaker.samplingDurationMs` | integer (≥ 1) |  | `10000` | Length of the trailing window the error ratio is measured over, in ms. |
| `externalApis.OLLAMA_SEARCH.resilience.circuitBreaker.minimumThroughput` | integer (≥ 1) |  | `5` | Calls per second the window must average before the circuit may open at all. |
| `externalApis.OLLAMA_SEARCH.retriableStatusCodes` | array of integer |  | `[500,502,503,504]` | HTTP statuses counted as transient failures, for retry and for the circuit breaker. |
| `externalApis.OLLAMA_SEARCH.logging` | object |  | `{"enabled":true,"headers":{"enabled":false,"redactPaths":[]},"query":{"enabled":false,"redactPaths":[]},"request":{"enabled":false,"redactPaths":[]},"response":{"enabled":false,"redactPaths":[]},"stack":false}` | Outbound request logging. Metadata only by default; each payload section is opt-in and redacted before it reaches the logger. |
| `externalApis.OLLAMA_SEARCH.logging.headers` | object |  |  | Request headers. The names of the transport headers the auth config sends are always added to `redactPaths`. |
| `externalApis.OLLAMA_SEARCH.logging.headers.enabled` | boolean |  | `false` | Log this section. Off unless switched on. |
| `externalApis.OLLAMA_SEARCH.logging.headers.redactPaths` | array of string (non-empty) |  | `["authorization","Authorization","cookie","Cookie","[\"set-cookie\"]","[\"proxy-authorization\"]","[\"x-api-key\"]"]` | Paths whose values are censored before logging (`fast-redact` syntax; hyphenated names in bracket notation, e.g. `["x-api-key"]`). |
| `externalApis.OLLAMA_SEARCH.logging.query` | object |  |  | Query parameters. The names of the transport query parameters the auth config sends are always added to `redactPaths`. |
| `externalApis.OLLAMA_SEARCH.logging.query.enabled` | boolean |  | `false` | Log this section. Off unless switched on. |
| `externalApis.OLLAMA_SEARCH.logging.query.redactPaths` | array of string (non-empty) |  | `[]` | Paths whose values are censored before logging (`fast-redact` syntax; hyphenated names in bracket notation, e.g. `["x-api-key"]`). |
| `externalApis.OLLAMA_SEARCH.logging.request` | object |  |  | Request body. |
| `externalApis.OLLAMA_SEARCH.logging.request.enabled` | boolean |  | `false` | Log this section. Off unless switched on. |
| `externalApis.OLLAMA_SEARCH.logging.request.redactPaths` | array of string (non-empty) |  | `[]` | Paths whose values are censored before logging (`fast-redact` syntax; hyphenated names in bracket notation, e.g. `["x-api-key"]`). |
| `externalApis.OLLAMA_SEARCH.logging.response` | object |  |  | Response body. |
| `externalApis.OLLAMA_SEARCH.logging.response.enabled` | boolean |  | `false` | Log this section. Off unless switched on. |
| `externalApis.OLLAMA_SEARCH.logging.response.redactPaths` | array of string (non-empty) |  | `[]` | Paths whose values are censored before logging (`fast-redact` syntax; hyphenated names in bracket notation, e.g. `["x-api-key"]`). |
| `externalApis.OLLAMA_SEARCH.logging.enabled` | boolean |  | `true` | Log outbound requests. `false` turns the logging off entirely. |
| `externalApis.OLLAMA_SEARCH.logging.stack` | boolean |  | `false` | Include the error stack when a request fails. |

### `externalApis.OLLAMA.auth`: one of 4

Pick the variant with `strategy`.

#### `externalApis.OLLAMA.auth` — `strategy: "kubernetes-service-account"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA.auth.strategy` | `"kubernetes-service-account"` | yes |  | Send the pod's Kubernetes service account token. The file is read on every request, so kubelet rotation is picked up. |
| `externalApis.OLLAMA.auth.tokenPath` | string |  | `"/var/run/secrets/kubernetes.io/serviceaccount/token"` | Path of the projected service account token file. |
| `externalApis.OLLAMA.auth.transport` | object |  | `{"headers":[{"name":"Authorization","credential":"value","prefix":"Bearer "}]}` | Where the token goes. The credential is named `value`. Default: `Authorization: Bearer <token>`. |
| `externalApis.OLLAMA.auth.transport.headers` | array of one of (see below) |  |  | Headers to send. Each entry carries either a fixed `value` or a `credential`. |
| `externalApis.OLLAMA.auth.transport.queryParams` | array of one of (see below) |  |  | Query parameters to send. Each entry carries either a fixed `value` or a `credential`. |

##### `externalApis.OLLAMA.auth.transport.headers[]`: one of 2

Give exactly one of the shapes below.

###### `externalApis.OLLAMA.auth.transport.headers[]` — with `credential`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA.auth.transport.headers[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.OLLAMA.auth.transport.headers[].credential` | string (non-empty) | yes |  | Name of a credential the auth strategy produces: `value`, or for `token-exchange` an `as` name from `tokenExtractor`. |
| `externalApis.OLLAMA.auth.transport.headers[].prefix` | string |  |  | Text put before the credential, e.g. `Bearer `. |
| `externalApis.OLLAMA.auth.transport.headers[].suffix` | string |  |  | Text put after the credential. |

###### `externalApis.OLLAMA.auth.transport.headers[]` — with `value`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA.auth.transport.headers[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.OLLAMA.auth.transport.headers[].value` | string | yes |  | Fixed value sent as is. |

##### `externalApis.OLLAMA.auth.transport.queryParams[]`: one of 2

Give exactly one of the shapes below.

###### `externalApis.OLLAMA.auth.transport.queryParams[]` — with `credential`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA.auth.transport.queryParams[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.OLLAMA.auth.transport.queryParams[].credential` | string (non-empty) | yes |  | Name of a credential the auth strategy produces: `value`, or for `token-exchange` an `as` name from `tokenExtractor`. |
| `externalApis.OLLAMA.auth.transport.queryParams[].prefix` | string |  |  | Text put before the credential, e.g. `Bearer `. |
| `externalApis.OLLAMA.auth.transport.queryParams[].suffix` | string |  |  | Text put after the credential. |

###### `externalApis.OLLAMA.auth.transport.queryParams[]` — with `value`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA.auth.transport.queryParams[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.OLLAMA.auth.transport.queryParams[].value` | string | yes |  | Fixed value sent as is. |

#### `externalApis.OLLAMA.auth` — `strategy: "token-exchange"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA.auth.strategy` | `"token-exchange"` | yes |  | Fetch a token from a token endpoint and cache it; a 401 from the upstream drops the cache and the next request fetches a new one. |
| `externalApis.OLLAMA.auth.request` | object | yes |  | The token request. |
| `externalApis.OLLAMA.auth.request.method` | `"GET"` \| `"POST"` \| `"PUT"` \| `"PATCH"` |  | `"POST"` | HTTP method of the token request. |
| `externalApis.OLLAMA.auth.request.url` | string (uri) | yes |  | URL of the token endpoint. |
| `externalApis.OLLAMA.auth.request.headers` | array of object |  |  | Fixed headers sent with the token request. |
| `externalApis.OLLAMA.auth.request.headers[].name` | string | yes |  | Header or query parameter name. |
| `externalApis.OLLAMA.auth.request.headers[].value` | string | yes |  | Fixed value sent as is. |
| `externalApis.OLLAMA.auth.request.queryParams` | array of object |  |  | Fixed query parameters sent with the token request. |
| `externalApis.OLLAMA.auth.request.queryParams[].name` | string | yes |  | Header or query parameter name. |
| `externalApis.OLLAMA.auth.request.queryParams[].value` | string | yes |  | Fixed value sent as is. |
| `externalApis.OLLAMA.auth.request.body` | object |  |  | Request body of the token request, sent as given. |
| `externalApis.OLLAMA.auth.tokenExtractor` | one of (see below) | yes |  | Which fields of the token response become credentials. A string is shorthand for one field stored as `value`; a list names each field and the credential name it is stored as. |
| `externalApis.OLLAMA.auth.expiresIn` | string |  |  | Dot-notation path of the token lifetime in seconds in the token response (e.g. `expires_in`). Unset: the token is cached until the upstream answers 401. |
| `externalApis.OLLAMA.auth.expiryMargin` | number (≥ 0) |  |  | Seconds before expiry at which a new token is fetched. Default 30. Used only with `expiresIn`. |
| `externalApis.OLLAMA.auth.transport` | object | yes |  | Where the extracted credentials go. |
| `externalApis.OLLAMA.auth.transport.headers` | array of one of (see below) |  |  | Headers to send. Each entry carries either a fixed `value` or a `credential`. |
| `externalApis.OLLAMA.auth.transport.queryParams` | array of one of (see below) |  |  | Query parameters to send. Each entry carries either a fixed `value` or a `credential`. |

##### `externalApis.OLLAMA.auth.transport.headers[]`

Same shapes as described above, first listed under `externalApis.OLLAMA.auth — strategy: "kubernetes-service-account"`.

##### `externalApis.OLLAMA.auth.transport.queryParams[]`

Same shapes as described above, first listed under `externalApis.OLLAMA.auth — strategy: "kubernetes-service-account"`.

#### `externalApis.OLLAMA.auth` — `strategy: "jwt-self-signed"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA.auth.strategy` | `"jwt-self-signed"` | yes |  | Sign a JWT locally and send it. The token is reused until shortly before it expires. |
| `externalApis.OLLAMA.auth.key` | one of (see below) | yes |  | Signing key. |
| `externalApis.OLLAMA.auth.algorithm` | `"RS256"` \| `"ES256"` \| `"HS256"` |  | `"RS256"` | Signing algorithm. |
| `externalApis.OLLAMA.auth.claims` | object |  |  | Claims of the signed token. |
| `externalApis.OLLAMA.auth.claims.iss` | string |  |  | `iss` claim. Omitted from the token when unset. |
| `externalApis.OLLAMA.auth.claims.sub` | string |  |  | `sub` claim. Omitted from the token when unset. |
| `externalApis.OLLAMA.auth.claims.aud` | one of (see below) |  |  | `aud` claim, one audience or a list. Omitted from the token when unset. |
| `externalApis.OLLAMA.auth.claims.exp` | integer (> 0) |  | `3600` | Token lifetime in seconds. `iat` is always set. |
| `externalApis.OLLAMA.auth.claims.additionalClaims` | object |  |  | Further claims added to the payload as given. |
| `externalApis.OLLAMA.auth.transport` | object |  | `{"headers":[{"name":"Authorization","credential":"value","prefix":"Bearer "}]}` | Where the token goes. The credential is named `value`. Default: `Authorization: Bearer <token>`. |
| `externalApis.OLLAMA.auth.transport.headers` | array of one of (see below) |  |  | Headers to send. Each entry carries either a fixed `value` or a `credential`. |
| `externalApis.OLLAMA.auth.transport.queryParams` | array of one of (see below) |  |  | Query parameters to send. Each entry carries either a fixed `value` or a `credential`. |

##### `externalApis.OLLAMA.auth.key`: one of 2

Pick the variant with `source`.

###### `externalApis.OLLAMA.auth.key` — `source: "file"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA.auth.key.source` | `"file"` | yes |  | Key read from a file when a token is signed. |
| `externalApis.OLLAMA.auth.key.path` | string | yes |  | Path of the key file. |

###### `externalApis.OLLAMA.auth.key` — `source: "value"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA.auth.key.source` | `"value"` | yes |  | Key carried in the configuration itself. |
| `externalApis.OLLAMA.auth.key.value` | string | yes |  | The key: an HMAC secret for HS256, otherwise a PEM-encoded PKCS#8 private key. |

##### `externalApis.OLLAMA.auth.transport.headers[]`

Same shapes as described above, first listed under `externalApis.OLLAMA.auth — strategy: "kubernetes-service-account"`.

##### `externalApis.OLLAMA.auth.transport.queryParams[]`

Same shapes as described above, first listed under `externalApis.OLLAMA.auth — strategy: "kubernetes-service-account"`.

#### `externalApis.OLLAMA.auth` — `strategy: "none"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA.auth.strategy` | `"none"` |  |  | No credential is produced. Fixed headers or query parameters may still be sent through `transport`. |
| `externalApis.OLLAMA.auth.transport` | object |  |  | Fixed headers and query parameters, e.g. an API key. |
| `externalApis.OLLAMA.auth.transport.headers` | array of object |  |  | Fixed headers to send. |
| `externalApis.OLLAMA.auth.transport.headers[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.OLLAMA.auth.transport.headers[].value` | string | yes |  | Fixed value sent as is. |
| `externalApis.OLLAMA.auth.transport.queryParams` | array of object |  |  | Fixed query parameters to send. |
| `externalApis.OLLAMA.auth.transport.queryParams[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.OLLAMA.auth.transport.queryParams[].value` | string | yes |  | Fixed value sent as is. |

### `externalApis.OLLAMA_SEARCH.auth`: one of 4

Pick the variant with `strategy`.

#### `externalApis.OLLAMA_SEARCH.auth` — `strategy: "kubernetes-service-account"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA_SEARCH.auth.strategy` | `"kubernetes-service-account"` | yes |  | Send the pod's Kubernetes service account token. The file is read on every request, so kubelet rotation is picked up. |
| `externalApis.OLLAMA_SEARCH.auth.tokenPath` | string |  | `"/var/run/secrets/kubernetes.io/serviceaccount/token"` | Path of the projected service account token file. |
| `externalApis.OLLAMA_SEARCH.auth.transport` | object |  | `{"headers":[{"name":"Authorization","credential":"value","prefix":"Bearer "}]}` | Where the token goes. The credential is named `value`. Default: `Authorization: Bearer <token>`. |
| `externalApis.OLLAMA_SEARCH.auth.transport.headers` | array of one of (see below) |  |  | Headers to send. Each entry carries either a fixed `value` or a `credential`. |
| `externalApis.OLLAMA_SEARCH.auth.transport.queryParams` | array of one of (see below) |  |  | Query parameters to send. Each entry carries either a fixed `value` or a `credential`. |

##### `externalApis.OLLAMA_SEARCH.auth.transport.headers[]`: one of 2

Give exactly one of the shapes below.

###### `externalApis.OLLAMA_SEARCH.auth.transport.headers[]` — with `credential`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA_SEARCH.auth.transport.headers[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.OLLAMA_SEARCH.auth.transport.headers[].credential` | string (non-empty) | yes |  | Name of a credential the auth strategy produces: `value`, or for `token-exchange` an `as` name from `tokenExtractor`. |
| `externalApis.OLLAMA_SEARCH.auth.transport.headers[].prefix` | string |  |  | Text put before the credential, e.g. `Bearer `. |
| `externalApis.OLLAMA_SEARCH.auth.transport.headers[].suffix` | string |  |  | Text put after the credential. |

###### `externalApis.OLLAMA_SEARCH.auth.transport.headers[]` — with `value`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA_SEARCH.auth.transport.headers[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.OLLAMA_SEARCH.auth.transport.headers[].value` | string | yes |  | Fixed value sent as is. |

##### `externalApis.OLLAMA_SEARCH.auth.transport.queryParams[]`: one of 2

Give exactly one of the shapes below.

###### `externalApis.OLLAMA_SEARCH.auth.transport.queryParams[]` — with `credential`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA_SEARCH.auth.transport.queryParams[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.OLLAMA_SEARCH.auth.transport.queryParams[].credential` | string (non-empty) | yes |  | Name of a credential the auth strategy produces: `value`, or for `token-exchange` an `as` name from `tokenExtractor`. |
| `externalApis.OLLAMA_SEARCH.auth.transport.queryParams[].prefix` | string |  |  | Text put before the credential, e.g. `Bearer `. |
| `externalApis.OLLAMA_SEARCH.auth.transport.queryParams[].suffix` | string |  |  | Text put after the credential. |

###### `externalApis.OLLAMA_SEARCH.auth.transport.queryParams[]` — with `value`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA_SEARCH.auth.transport.queryParams[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.OLLAMA_SEARCH.auth.transport.queryParams[].value` | string | yes |  | Fixed value sent as is. |

#### `externalApis.OLLAMA_SEARCH.auth` — `strategy: "token-exchange"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA_SEARCH.auth.strategy` | `"token-exchange"` | yes |  | Fetch a token from a token endpoint and cache it; a 401 from the upstream drops the cache and the next request fetches a new one. |
| `externalApis.OLLAMA_SEARCH.auth.request` | object | yes |  | The token request. |
| `externalApis.OLLAMA_SEARCH.auth.request.method` | `"GET"` \| `"POST"` \| `"PUT"` \| `"PATCH"` |  | `"POST"` | HTTP method of the token request. |
| `externalApis.OLLAMA_SEARCH.auth.request.url` | string (uri) | yes |  | URL of the token endpoint. |
| `externalApis.OLLAMA_SEARCH.auth.request.headers` | array of object |  |  | Fixed headers sent with the token request. |
| `externalApis.OLLAMA_SEARCH.auth.request.headers[].name` | string | yes |  | Header or query parameter name. |
| `externalApis.OLLAMA_SEARCH.auth.request.headers[].value` | string | yes |  | Fixed value sent as is. |
| `externalApis.OLLAMA_SEARCH.auth.request.queryParams` | array of object |  |  | Fixed query parameters sent with the token request. |
| `externalApis.OLLAMA_SEARCH.auth.request.queryParams[].name` | string | yes |  | Header or query parameter name. |
| `externalApis.OLLAMA_SEARCH.auth.request.queryParams[].value` | string | yes |  | Fixed value sent as is. |
| `externalApis.OLLAMA_SEARCH.auth.request.body` | object |  |  | Request body of the token request, sent as given. |
| `externalApis.OLLAMA_SEARCH.auth.tokenExtractor` | one of (see below) | yes |  | Which fields of the token response become credentials. A string is shorthand for one field stored as `value`; a list names each field and the credential name it is stored as. |
| `externalApis.OLLAMA_SEARCH.auth.expiresIn` | string |  |  | Dot-notation path of the token lifetime in seconds in the token response (e.g. `expires_in`). Unset: the token is cached until the upstream answers 401. |
| `externalApis.OLLAMA_SEARCH.auth.expiryMargin` | number (≥ 0) |  |  | Seconds before expiry at which a new token is fetched. Default 30. Used only with `expiresIn`. |
| `externalApis.OLLAMA_SEARCH.auth.transport` | object | yes |  | Where the extracted credentials go. |
| `externalApis.OLLAMA_SEARCH.auth.transport.headers` | array of one of (see below) |  |  | Headers to send. Each entry carries either a fixed `value` or a `credential`. |
| `externalApis.OLLAMA_SEARCH.auth.transport.queryParams` | array of one of (see below) |  |  | Query parameters to send. Each entry carries either a fixed `value` or a `credential`. |

##### `externalApis.OLLAMA_SEARCH.auth.transport.headers[]`

Same shapes as described above, first listed under `externalApis.OLLAMA_SEARCH.auth — strategy: "kubernetes-service-account"`.

##### `externalApis.OLLAMA_SEARCH.auth.transport.queryParams[]`

Same shapes as described above, first listed under `externalApis.OLLAMA_SEARCH.auth — strategy: "kubernetes-service-account"`.

#### `externalApis.OLLAMA_SEARCH.auth` — `strategy: "jwt-self-signed"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA_SEARCH.auth.strategy` | `"jwt-self-signed"` | yes |  | Sign a JWT locally and send it. The token is reused until shortly before it expires. |
| `externalApis.OLLAMA_SEARCH.auth.key` | one of (see below) | yes |  | Signing key. |
| `externalApis.OLLAMA_SEARCH.auth.algorithm` | `"RS256"` \| `"ES256"` \| `"HS256"` |  | `"RS256"` | Signing algorithm. |
| `externalApis.OLLAMA_SEARCH.auth.claims` | object |  |  | Claims of the signed token. |
| `externalApis.OLLAMA_SEARCH.auth.claims.iss` | string |  |  | `iss` claim. Omitted from the token when unset. |
| `externalApis.OLLAMA_SEARCH.auth.claims.sub` | string |  |  | `sub` claim. Omitted from the token when unset. |
| `externalApis.OLLAMA_SEARCH.auth.claims.aud` | one of (see below) |  |  | `aud` claim, one audience or a list. Omitted from the token when unset. |
| `externalApis.OLLAMA_SEARCH.auth.claims.exp` | integer (> 0) |  | `3600` | Token lifetime in seconds. `iat` is always set. |
| `externalApis.OLLAMA_SEARCH.auth.claims.additionalClaims` | object |  |  | Further claims added to the payload as given. |
| `externalApis.OLLAMA_SEARCH.auth.transport` | object |  | `{"headers":[{"name":"Authorization","credential":"value","prefix":"Bearer "}]}` | Where the token goes. The credential is named `value`. Default: `Authorization: Bearer <token>`. |
| `externalApis.OLLAMA_SEARCH.auth.transport.headers` | array of one of (see below) |  |  | Headers to send. Each entry carries either a fixed `value` or a `credential`. |
| `externalApis.OLLAMA_SEARCH.auth.transport.queryParams` | array of one of (see below) |  |  | Query parameters to send. Each entry carries either a fixed `value` or a `credential`. |

##### `externalApis.OLLAMA_SEARCH.auth.key`: one of 2

Pick the variant with `source`.

###### `externalApis.OLLAMA_SEARCH.auth.key` — `source: "file"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA_SEARCH.auth.key.source` | `"file"` | yes |  | Key read from a file when a token is signed. |
| `externalApis.OLLAMA_SEARCH.auth.key.path` | string | yes |  | Path of the key file. |

###### `externalApis.OLLAMA_SEARCH.auth.key` — `source: "value"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA_SEARCH.auth.key.source` | `"value"` | yes |  | Key carried in the configuration itself. |
| `externalApis.OLLAMA_SEARCH.auth.key.value` | string | yes |  | The key: an HMAC secret for HS256, otherwise a PEM-encoded PKCS#8 private key. |

##### `externalApis.OLLAMA_SEARCH.auth.transport.headers[]`

Same shapes as described above, first listed under `externalApis.OLLAMA_SEARCH.auth — strategy: "kubernetes-service-account"`.

##### `externalApis.OLLAMA_SEARCH.auth.transport.queryParams[]`

Same shapes as described above, first listed under `externalApis.OLLAMA_SEARCH.auth — strategy: "kubernetes-service-account"`.

#### `externalApis.OLLAMA_SEARCH.auth` — `strategy: "none"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.OLLAMA_SEARCH.auth.strategy` | `"none"` |  |  | No credential is produced. Fixed headers or query parameters may still be sent through `transport`. |
| `externalApis.OLLAMA_SEARCH.auth.transport` | object |  |  | Fixed headers and query parameters, e.g. an API key. |
| `externalApis.OLLAMA_SEARCH.auth.transport.headers` | array of object |  |  | Fixed headers to send. |
| `externalApis.OLLAMA_SEARCH.auth.transport.headers[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.OLLAMA_SEARCH.auth.transport.headers[].value` | string | yes |  | Fixed value sent as is. |
| `externalApis.OLLAMA_SEARCH.auth.transport.queryParams` | array of object |  |  | Fixed query parameters to send. |
| `externalApis.OLLAMA_SEARCH.auth.transport.queryParams[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.OLLAMA_SEARCH.auth.transport.queryParams[].value` | string | yes |  | Fixed value sent as is. |

## database

The Postgres database this service owns: schema, index and search.

Required.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `database.host` | string (non-empty) | yes |  | Postgres host. |
| `database.port` | integer (> 0) |  | `5432` | Postgres port. |
| `database.database` | string (non-empty) | yes |  | Database name. One database per environment: migrations run on it at boot. |
| `database.user` | string (non-empty) | yes |  | Role the service connects as. |
| `database.password` | string (non-empty) | yes |  | Password of `user`. |
| `database.sslMode` | `"DISABLE"` \| `"REQUIRE"` \| `"VERIFY_FULL"` |  | `"DISABLE"` | TLS towards Postgres. CloudNativePG serves TLS with its own CA: REQUIRE encrypts without verifying it. |
| `database.caFile` | string |  |  | PEM bundle to verify the server against. Required for VERIFY_FULL. |
| `database.pool` | object |  | `{}` | Connection pool (`pg.Pool`). |
| `database.pool.max` | integer (> 0) |  | `5` | One connection is held for the whole indexing run (the advisory lock lives on it). |
| `database.pool.idleTimeoutMs` | integer (≥ 0) |  | `30000` | How long an idle connection stays open before the pool closes it (pg `idleTimeoutMillis`). |
| `database.pool.connectionTimeoutMs` | integer (> 0) |  | `5000` | How long acquiring a new connection may take before it fails (pg `connectionTimeoutMillis`). |
| `database.statementTimeoutMs` | integer (> 0) |  | `30000` | Postgres `statement_timeout` set on every connection: a longer statement is cancelled. |

## github

GitHub credentials — an App or a token — for every knowledge base with source GIT that has no `git.github` of its own.

Optional.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `github` | one of (see below) |  |  | GitHub credentials — an App or a token — for every knowledge base with source GIT that has no `git.github` of its own. |

### `github`: one of 2

Pick the variant with `type`.

#### `github` — `type: "app"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `github.baseUrl` | string (uri) |  | `"https://api.github.com"` | GitHub REST API base URL, passed to Octokit. |
| `github.timeoutMs` | integer (> 0) |  | `15000` | Per attempt: each retry gets its own. A rate-limit wait between attempts is not counted. |
| `github.retries` | integer (≥ 0, ≤ 10) |  | `3` | Octokit retries server errors with backoff; rate limits are waited out separately. |
| `github.type` | `"app"` | yes |  | `app`: authenticate as a GitHub App. The default when `type` is left out. |
| `github.clientId` | string (non-empty) | yes |  | The App's client ID — the JWT issuer GitHub expects. |
| `github.privateKey` | one of (see below) | yes |  | PEM as GitHub issues it (PKCS#1); PKCS#8 works too. |

##### `github.privateKey`: one of 2

Pick the variant with `source`.

###### `github.privateKey` — `source: "value"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `github.privateKey.source` | `"value"` | yes |  | `value`: the secret is inline. |
| `github.privateKey.value` | string (non-empty) | yes |  | The secret itself. |

###### `github.privateKey` — `source: "file"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `github.privateKey.source` | `"file"` | yes |  | `file`: the secret is read from a file, e.g. a mounted Kubernetes secret. |
| `github.privateKey.path` | string (non-empty) | yes |  | Path of the file holding the secret; surrounding whitespace is trimmed. |

#### `github` — `type: "token"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `github.baseUrl` | string (uri) |  | `"https://api.github.com"` | GitHub REST API base URL, passed to Octokit. |
| `github.timeoutMs` | integer (> 0) |  | `15000` | Per attempt: each retry gets its own. A rate-limit wait between attempts is not counted. |
| `github.retries` | integer (≥ 0, ≤ 10) |  | `3` | Octokit retries server errors with backoff; rate limits are waited out separately. |
| `github.type` | `"token"` | yes |  | `token`: authenticate with a token, e.g. a fine-grained personal access token. A knowledge base using one must set `git.repository`. |
| `github.token` | one of (see below) | yes |  | Needs Contents: read and write, and Metadata: read, on the repository. |

##### `github.token`: one of 2

Pick the variant with `source`.

###### `github.token` — `source: "value"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `github.token.source` | `"value"` | yes |  | `value`: the secret is inline. |
| `github.token.value` | string (non-empty) | yes |  | The secret itself. |

###### `github.token` — `source: "file"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `github.token.source` | `"file"` | yes |  | `file`: the secret is read from a file, e.g. a mounted Kubernetes secret. |
| `github.token.path` | string (non-empty) | yes |  | Path of the file holding the secret; surrounding whitespace is trimmed. |

## embeddings

Embedding models served by Ollama.

Optional. Default `{}`.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `embeddings.models` | array of object |  | `[]` | Embedding models a knowledge base may name in its `models`. Names must be unique. Empty: every knowledge base is full-text only. |
| `embeddings.models[].name` | string (non-empty) | yes |  | Ollama model tag, e.g. `embeddinggemma:300m`. Stored in `embeddings.model`. |
| `embeddings.models[].dimensions` | integer (> 0, ≤ 2000) | yes |  | Vector length the model returns. It becomes the cast in this model's HNSW index, so a mismatch fails the first insert instead of silently mixing lengths. pgvector indexes `vector` up to 2000 dimensions. |
| `embeddings.models[].documentTemplate` | string (includes, pattern `\{text\}`) |  | `"{text}"` | What a chunk is sent as; must contain `{text}`. `{title}` is the document title (`none` when it has none, as the embeddinggemma model card prescribes); `{text}` is the heading path, a blank line and the body. Task prefixes are part of the model contract — embeddinggemma scores worse without them. Changing a template changes every vector: give the model a new entry instead. |
| `embeddings.models[].queryTemplate` | string (includes, pattern `\{query\}`) |  | `"{query}"` | What a question is sent as; must contain `{query}`, the question. See `documentTemplate`. |
| `embeddings.batchSize` | integer (> 0, ≤ 256) |  | `16` | Chunks per Ollama embed call. |
| `embeddings.keepAlive` | string |  | `"1m"` | Ollama keep_alive: long enough that a run does not reload the model per batch, short enough that a chat model on the same node gets its memory back. |

## knowledgeBases

Every knowledge base this service indexes and serves.

Required.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `knowledgeBases` | array of object (at least 1 item) | yes |  | Every knowledge base this service indexes and serves. |
| `knowledgeBases[].id` | string (pattern `^[a-z][a-z0-9-]{0,31}$`) | yes |  | Stored in `documents.kb`; what callers pass as `kb`. |
| `knowledgeBases[].contentType` | `"MARKDOWN"` |  | `"MARKDOWN"` | Picks the chunker. `MARKDOWN`: Markdown with optional YAML frontmatter, chunked at H2/H3. |
| `knowledgeBases[].tsConfig` | string (pattern `^[a-z_]+$`) |  | `"english"` | Postgres text search configuration for this KB's full-text index, e.g. `english`, `simple`. |
| `knowledgeBases[].models` | array of string (non-empty) |  | `[]` | Embedding models this KB is embedded with, by `embeddings.models[].name`; each must be declared there. The **first** answers questions; the others are built alongside for comparison. Empty means full-text only. |
| `knowledgeBases[].readers` | array of string (non-empty) (at least 1 item) | yes |  | Authentik roles allowed to read this KB. A caller holding none of them never sees it. |
| `knowledgeBases[].conventionsPath` | string (non-empty, pattern `^[^/]`) |  |  | The file in the source that holds this KB's house rules — formats, frontmatter, areas, naming — e.g. `README.md`, without a leading `/`. `GET /conventions` serves it, read from the source as it is now, so it need not be under `git.include`. Unset: the KB publishes none. |
| `knowledgeBases[].chunking` | object |  | `{}` | How documents are cut into chunks. |
| `knowledgeBases[].chunking.maxChars` | integer (≥ 200) |  | `3000` | A section longer than this is split at paragraph boundaries, the heading kept on every part. 3000 is what the model measurement ran with: chunks p50 721, p95 2719, max 3226 characters on the development KB — inside embeddinggemma's 2k-token context. |
| `knowledgeBases[].chunking.overlapChars` | integer (≥ 0) |  | `0` | Trailing paragraphs of one part repeated at the start of the next, up to this length. |
| `knowledgeBases[].source` | `"GIT"` | yes |  | `GIT`: documents are read from a GitHub repository. |
| `knowledgeBases[].git` | object |  | `{}` | The GitHub repository this knowledge base is read from. |
| `knowledgeBases[].git.branch` | string (non-empty) |  |  | Branch to index. Defaults to the repository's default branch. |
| `knowledgeBases[].git.include` | array of string |  | `["raw/","work/","mirror/"]` | Path prefixes to index. The first path segment becomes `metadata.area`. |
| `knowledgeBases[].git.extensions` | array of string (starts_with, pattern `^\..*`) |  | `[".md"]` | File extensions to index, each starting with `.`. A file is indexed when its path matches both `include` and one of these. |
| `knowledgeBases[].git.repository` | string (pattern `^[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$`) |  |  | `owner/name` of the repository to read, from those the App covers, compared case-insensitively. Required when the App covers several, and always with a token. Comes from a secret, never from values. |
| `knowledgeBases[].git.github` | one of (see below) |  |  | The GitHub App or token of this knowledge base. Defaults to the root `github`. |

### `knowledgeBases[].git.github`: one of 2

Pick the variant with `type`.

#### `knowledgeBases[].git.github` — `type: "app"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `knowledgeBases[].git.github.baseUrl` | string (uri) |  | `"https://api.github.com"` | GitHub REST API base URL, passed to Octokit. |
| `knowledgeBases[].git.github.timeoutMs` | integer (> 0) |  | `15000` | Per attempt: each retry gets its own. A rate-limit wait between attempts is not counted. |
| `knowledgeBases[].git.github.retries` | integer (≥ 0, ≤ 10) |  | `3` | Octokit retries server errors with backoff; rate limits are waited out separately. |
| `knowledgeBases[].git.github.type` | `"app"` | yes |  | `app`: authenticate as a GitHub App. The default when `type` is left out. |
| `knowledgeBases[].git.github.clientId` | string (non-empty) | yes |  | The App's client ID — the JWT issuer GitHub expects. |
| `knowledgeBases[].git.github.privateKey` | one of (see below) | yes |  | PEM as GitHub issues it (PKCS#1); PKCS#8 works too. |

##### `knowledgeBases[].git.github.privateKey`: one of 2

Pick the variant with `source`.

###### `knowledgeBases[].git.github.privateKey` — `source: "value"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `knowledgeBases[].git.github.privateKey.source` | `"value"` | yes |  | `value`: the secret is inline. |
| `knowledgeBases[].git.github.privateKey.value` | string (non-empty) | yes |  | The secret itself. |

###### `knowledgeBases[].git.github.privateKey` — `source: "file"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `knowledgeBases[].git.github.privateKey.source` | `"file"` | yes |  | `file`: the secret is read from a file, e.g. a mounted Kubernetes secret. |
| `knowledgeBases[].git.github.privateKey.path` | string (non-empty) | yes |  | Path of the file holding the secret; surrounding whitespace is trimmed. |

#### `knowledgeBases[].git.github` — `type: "token"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `knowledgeBases[].git.github.baseUrl` | string (uri) |  | `"https://api.github.com"` | GitHub REST API base URL, passed to Octokit. |
| `knowledgeBases[].git.github.timeoutMs` | integer (> 0) |  | `15000` | Per attempt: each retry gets its own. A rate-limit wait between attempts is not counted. |
| `knowledgeBases[].git.github.retries` | integer (≥ 0, ≤ 10) |  | `3` | Octokit retries server errors with backoff; rate limits are waited out separately. |
| `knowledgeBases[].git.github.type` | `"token"` | yes |  | `token`: authenticate with a token, e.g. a fine-grained personal access token. A knowledge base using one must set `git.repository`. |
| `knowledgeBases[].git.github.token` | one of (see below) | yes |  | Needs Contents: read and write, and Metadata: read, on the repository. |

##### `knowledgeBases[].git.github.token`: one of 2

Pick the variant with `source`.

###### `knowledgeBases[].git.github.token` — `source: "value"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `knowledgeBases[].git.github.token.source` | `"value"` | yes |  | `value`: the secret is inline. |
| `knowledgeBases[].git.github.token.value` | string (non-empty) | yes |  | The secret itself. |

###### `knowledgeBases[].git.github.token` — `source: "file"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `knowledgeBases[].git.github.token.source` | `"file"` | yes |  | `file`: the secret is read from a file, e.g. a mounted Kubernetes secret. |
| `knowledgeBases[].git.github.token.path` | string (non-empty) | yes |  | Path of the file holding the secret; surrounding whitespace is trimmed. |

## indexer

The background indexing loop.

Optional. Default `{}`.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `indexer.enabled` | boolean |  | `true` | Runs the background loop. POST /reindex works either way. |
| `indexer.intervalMs` | integer (≥ 10000) |  | `300000` | Pause between the end of one run and the start of the next. |
| `indexer.initialDelayMs` | integer (≥ 0) |  | `5000` | Delay from startup to the first run of the background loop. |
| `indexer.fetchConcurrency` | integer (≥ 1, ≤ 16) |  | `4` | Source documents fetched in parallel. |
| `indexer.maxScheduledEmbeddings` | integer (≥ 0) |  | `300` | Largest embedding backlog a scheduled run takes on, per model. A bigger one — a new model, a first build, a large import — waits for `POST /reindex`: a full embed saturates the Ollama node for ~25 minutes and evicts its chat model, so it is started by hand. |

## search

Hybrid search tuning.

Optional. Default `{}`.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `search.defaultLimit` | integer (≥ 1, ≤ 50) |  | `10` | Results returned by `GET /search` when the request sets no `limit`. |
| `search.candidates` | integer (≥ 10, ≤ 500) |  | `50` | Hits taken from each leg (full-text, the vector model) before fusion. |
| `search.rrfK` | integer (≥ 1) |  | `60` | Reciprocal rank fusion constant: score = Σ weight / (k + rank). |
| `search.weights` | object |  | `{}` | Per-leg RRF weights. The default is vector only: in the model measurement (16 real questions, embeddinggemma) vector alone scored MRR 0.86 and plain RRF with the full-text leg 0.79. Measure before raising `fullText` — `GET /search` takes per-request weights for exactly that. |
| `search.weights.fullText` | number (≥ 0, ≤ 10) |  | `0` | RRF weight of the full-text leg. At 0 it still runs, at weight 1, for chunks with no vector yet, and for knowledge bases with no model or when the vector leg is off. |
| `search.weights.vector` | number (≥ 0, ≤ 10) |  | `1` | RRF weight of the vector leg: each knowledge base's first model, or the model the request names. 0 drops the leg. |
| `search.fullTextMatch` | `"ANY"` \| `"ALL"` |  | `"ANY"` | How question terms combine in the full-text leg. |

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
