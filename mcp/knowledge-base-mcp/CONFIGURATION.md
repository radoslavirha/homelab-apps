# knowledge-base-mcp — configuration

<!-- Generated from the configuration schema. Do not edit by hand. -->

The service reads one JSON document (the `config` library: `config/<NODE_ENV>.json`; in a cluster, the mounted ConfigMap). It is validated at boot, and an invalid document stops the service. Keys not listed here are ignored.

**Required** means the key must be present whenever its parent is. A key with a default may be left out.

## Sections

| Section | Required | Description |
| --- | --- | --- |
| [`server`](#server) | yes | Ts.ED server settings. Keys other than httpPort are passed to the Ts.ED server configuration unchanged. |
| [`serviceName`](#servicename) |  | Service name. Defaults to the name in package.json. |
| [`publicURL`](#publicurl) | yes | Public base URL of the app: scheme, host and the route prefix, no endpoint path — `https://mcp.irha.cz/kb` deployed, `http://localhost:4004` locally. An endpoint's resource identifier is this plus its `path`. |
| [`externalApis`](#externalapis) | yes | APIs this server calls — base URL, auth, resilience and logging per API. |
| [`mcpServers`](#mcpservers) | yes | The MCP endpoints this app mounts, one per entry, each serving one knowledge base. At least one entry; `name` and `path` unique. |
| [`health`](#health) |  | Health endpoint configuration. |
| [`logger`](#logger) |  | Logger configuration. |
| [`otel`](#otel) |  | OpenTelemetry configuration. |

## Minimal example

Only the required keys, with placeholder values. Everything else falls back to its default.

```json
{
  "server": {
    "httpPort": 0
  },
  "publicURL": "https://example.com",
  "externalApis": {
    "KNOWLEDGE_BASE_API": {
      "baseURL": "https://example.com"
    }
  },
  "mcpServers": [
    {
      "path": "<string>",
      "kb": "<string>",
      "name": "<string>",
      "title": "<string>",
      "auth": {
        "issuer": "https://example.com",
        "audience": "<string>",
        "key": {
          "source": "value",
          "value": "<string>"
        },
        "roles": {
          "READER": "<string>",
          "EDITOR": "<string>"
        }
      }
    }
  ]
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

Public base URL of the app: scheme, host and the route prefix, no endpoint path — `https://mcp.irha.cz/kb` deployed, `http://localhost:4004` locally. An endpoint's resource identifier is this plus its `path`.

Required.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `publicURL` | string (uri) | yes |  | Public base URL of the app: scheme, host and the route prefix, no endpoint path — `https://mcp.irha.cz/kb` deployed, `http://localhost:4004` locally. An endpoint's resource identifier is this plus its `path`. |

## externalApis

APIs this server calls — base URL, auth, resilience and logging per API.

Required.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.KNOWLEDGE_BASE_API` | object | yes |  | One external API: base URL, auth, resilience and outbound logging. |
| `externalApis.KNOWLEDGE_BASE_API.baseURL` | string (uri) | yes |  | Base URL every request path is resolved against. |
| `externalApis.KNOWLEDGE_BASE_API.auth` | one of (see below) |  |  | How requests to this API are authenticated. Pick the variant with `strategy`; without `strategy` no credential is produced. |
| `externalApis.KNOWLEDGE_BASE_API.resilience` | object |  |  | Timeout, retry and circuit breaker for requests to this API. Omit to send requests without them. |
| `externalApis.KNOWLEDGE_BASE_API.resilience.timeout` | object |  |  | Per-attempt timeout. Omit to disable. |
| `externalApis.KNOWLEDGE_BASE_API.resilience.timeout.ms` | integer (≥ 0) |  | `5000` | Time limit for one attempt, in ms. When it runs out the attempt is aborted through its AbortSignal and rejects. |
| `externalApis.KNOWLEDGE_BASE_API.resilience.retry` | object |  |  | Retry policy. Omit to disable. Retries wrap the circuit breaker and the timeout, so each attempt gets its own timeout. |
| `externalApis.KNOWLEDGE_BASE_API.resilience.retry.count` | integer (≥ 0) |  | `0` | Additional attempts after the first one. `0` disables retry. |
| `externalApis.KNOWLEDGE_BASE_API.resilience.retry.backoffMs` | integer (≥ 0) |  | `250` | Constant delay between attempts, in ms. |
| `externalApis.KNOWLEDGE_BASE_API.resilience.circuitBreaker` | object |  |  | Sampling circuit breaker. Omit to disable; `{}` enables it with the defaults. |
| `externalApis.KNOWLEDGE_BASE_API.resilience.circuitBreaker.halfOpenAfterMs` | integer (≥ 0) |  | `10000` | How long the circuit stays open, in ms, before one trial call is let through (half-open). |
| `externalApis.KNOWLEDGE_BASE_API.resilience.circuitBreaker.threshold` | number (> 0, < 1) |  | `0.5` | Error ratio over the sampling window above which the circuit opens. |
| `externalApis.KNOWLEDGE_BASE_API.resilience.circuitBreaker.samplingDurationMs` | integer (≥ 1) |  | `10000` | Length of the trailing window the error ratio is measured over, in ms. |
| `externalApis.KNOWLEDGE_BASE_API.resilience.circuitBreaker.minimumThroughput` | integer (≥ 1) |  | `5` | Calls per second the window must average before the circuit may open at all. |
| `externalApis.KNOWLEDGE_BASE_API.retriableStatusCodes` | array of integer |  | `[500,502,503,504]` | HTTP statuses counted as transient failures, for retry and for the circuit breaker. |
| `externalApis.KNOWLEDGE_BASE_API.logging` | object |  | `{"enabled":true,"headers":{"enabled":false,"redactPaths":[]},"query":{"enabled":false,"redactPaths":[]},"request":{"enabled":false,"redactPaths":[]},"response":{"enabled":false,"redactPaths":[]},"stack":false}` | Outbound request logging. Metadata only by default; each payload section is opt-in and redacted before it reaches the logger. |
| `externalApis.KNOWLEDGE_BASE_API.logging.headers` | object |  |  | Request headers. The names of the transport headers the auth config sends are always added to `redactPaths`. |
| `externalApis.KNOWLEDGE_BASE_API.logging.headers.enabled` | boolean |  | `false` | Log this section. Off unless switched on. |
| `externalApis.KNOWLEDGE_BASE_API.logging.headers.redactPaths` | array of string (non-empty) |  | `["authorization","Authorization","cookie","Cookie","[\"set-cookie\"]","[\"proxy-authorization\"]","[\"x-api-key\"]"]` | Paths whose values are censored before logging (`fast-redact` syntax; hyphenated names in bracket notation, e.g. `["x-api-key"]`). |
| `externalApis.KNOWLEDGE_BASE_API.logging.query` | object |  |  | Query parameters. The names of the transport query parameters the auth config sends are always added to `redactPaths`. |
| `externalApis.KNOWLEDGE_BASE_API.logging.query.enabled` | boolean |  | `false` | Log this section. Off unless switched on. |
| `externalApis.KNOWLEDGE_BASE_API.logging.query.redactPaths` | array of string (non-empty) |  | `[]` | Paths whose values are censored before logging (`fast-redact` syntax; hyphenated names in bracket notation, e.g. `["x-api-key"]`). |
| `externalApis.KNOWLEDGE_BASE_API.logging.request` | object |  |  | Request body. |
| `externalApis.KNOWLEDGE_BASE_API.logging.request.enabled` | boolean |  | `false` | Log this section. Off unless switched on. |
| `externalApis.KNOWLEDGE_BASE_API.logging.request.redactPaths` | array of string (non-empty) |  | `[]` | Paths whose values are censored before logging (`fast-redact` syntax; hyphenated names in bracket notation, e.g. `["x-api-key"]`). |
| `externalApis.KNOWLEDGE_BASE_API.logging.response` | object |  |  | Response body. |
| `externalApis.KNOWLEDGE_BASE_API.logging.response.enabled` | boolean |  | `false` | Log this section. Off unless switched on. |
| `externalApis.KNOWLEDGE_BASE_API.logging.response.redactPaths` | array of string (non-empty) |  | `[]` | Paths whose values are censored before logging (`fast-redact` syntax; hyphenated names in bracket notation, e.g. `["x-api-key"]`). |
| `externalApis.KNOWLEDGE_BASE_API.logging.enabled` | boolean |  | `true` | Log outbound requests. `false` turns the logging off entirely. |
| `externalApis.KNOWLEDGE_BASE_API.logging.stack` | boolean |  | `false` | Include the error stack when a request fails. |

### `externalApis.KNOWLEDGE_BASE_API.auth`: one of 4

Pick the variant with `strategy`.

#### `externalApis.KNOWLEDGE_BASE_API.auth` — `strategy: "kubernetes-service-account"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.KNOWLEDGE_BASE_API.auth.strategy` | `"kubernetes-service-account"` | yes |  | Send the pod's Kubernetes service account token. The file is read on every request, so kubelet rotation is picked up. |
| `externalApis.KNOWLEDGE_BASE_API.auth.tokenPath` | string |  | `"/var/run/secrets/kubernetes.io/serviceaccount/token"` | Path of the projected service account token file. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport` | object |  | `{"headers":[{"name":"Authorization","credential":"value","prefix":"Bearer "}]}` | Where the token goes. The credential is named `value`. Default: `Authorization: Bearer <token>`. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers` | array of one of (see below) |  |  | Headers to send. Each entry carries either a fixed `value` or a `credential`. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams` | array of one of (see below) |  |  | Query parameters to send. Each entry carries either a fixed `value` or a `credential`. |

##### `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers[]`: one of 2

Give exactly one of the shapes below.

###### `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers[]` — with `credential`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers[].credential` | string (non-empty) | yes |  | Name of a credential the auth strategy produces: `value`, or for `token-exchange` an `as` name from `tokenExtractor`. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers[].prefix` | string |  |  | Text put before the credential, e.g. `Bearer `. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers[].suffix` | string |  |  | Text put after the credential. |

###### `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers[]` — with `value`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers[].value` | string | yes |  | Fixed value sent as is. |

##### `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams[]`: one of 2

Give exactly one of the shapes below.

###### `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams[]` — with `credential`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams[].credential` | string (non-empty) | yes |  | Name of a credential the auth strategy produces: `value`, or for `token-exchange` an `as` name from `tokenExtractor`. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams[].prefix` | string |  |  | Text put before the credential, e.g. `Bearer `. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams[].suffix` | string |  |  | Text put after the credential. |

###### `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams[]` — with `value`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams[].value` | string | yes |  | Fixed value sent as is. |

#### `externalApis.KNOWLEDGE_BASE_API.auth` — `strategy: "token-exchange"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.KNOWLEDGE_BASE_API.auth.strategy` | `"token-exchange"` | yes |  | Fetch a token from a token endpoint and cache it; a 401 from the upstream drops the cache and the next request fetches a new one. |
| `externalApis.KNOWLEDGE_BASE_API.auth.request` | object | yes |  | The token request. |
| `externalApis.KNOWLEDGE_BASE_API.auth.request.method` | `"GET"` \| `"POST"` \| `"PUT"` \| `"PATCH"` |  | `"POST"` | HTTP method of the token request. |
| `externalApis.KNOWLEDGE_BASE_API.auth.request.url` | string (uri) | yes |  | URL of the token endpoint. |
| `externalApis.KNOWLEDGE_BASE_API.auth.request.headers` | array of object |  |  | Fixed headers sent with the token request. |
| `externalApis.KNOWLEDGE_BASE_API.auth.request.headers[].name` | string | yes |  | Header or query parameter name. |
| `externalApis.KNOWLEDGE_BASE_API.auth.request.headers[].value` | string | yes |  | Fixed value sent as is. |
| `externalApis.KNOWLEDGE_BASE_API.auth.request.queryParams` | array of object |  |  | Fixed query parameters sent with the token request. |
| `externalApis.KNOWLEDGE_BASE_API.auth.request.queryParams[].name` | string | yes |  | Header or query parameter name. |
| `externalApis.KNOWLEDGE_BASE_API.auth.request.queryParams[].value` | string | yes |  | Fixed value sent as is. |
| `externalApis.KNOWLEDGE_BASE_API.auth.request.body` | object |  |  | Request body of the token request, sent as given. |
| `externalApis.KNOWLEDGE_BASE_API.auth.tokenExtractor` | one of (see below) | yes |  | Which fields of the token response become credentials. A string is shorthand for one field stored as `value`; a list names each field and the credential name it is stored as. |
| `externalApis.KNOWLEDGE_BASE_API.auth.expiresIn` | string |  |  | Dot-notation path of the token lifetime in seconds in the token response (e.g. `expires_in`). Unset: the token is cached until the upstream answers 401. |
| `externalApis.KNOWLEDGE_BASE_API.auth.expiryMargin` | number (≥ 0) |  |  | Seconds before expiry at which a new token is fetched. Default 30. Used only with `expiresIn`. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport` | object | yes |  | Where the extracted credentials go. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers` | array of one of (see below) |  |  | Headers to send. Each entry carries either a fixed `value` or a `credential`. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams` | array of one of (see below) |  |  | Query parameters to send. Each entry carries either a fixed `value` or a `credential`. |

##### `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers[]`

Same shapes as described above, first listed under `externalApis.KNOWLEDGE_BASE_API.auth — strategy: "kubernetes-service-account"`.

##### `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams[]`

Same shapes as described above, first listed under `externalApis.KNOWLEDGE_BASE_API.auth — strategy: "kubernetes-service-account"`.

#### `externalApis.KNOWLEDGE_BASE_API.auth` — `strategy: "jwt-self-signed"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.KNOWLEDGE_BASE_API.auth.strategy` | `"jwt-self-signed"` | yes |  | Sign a JWT locally and send it. The token is reused until shortly before it expires. |
| `externalApis.KNOWLEDGE_BASE_API.auth.key` | one of (see below) | yes |  | Signing key. |
| `externalApis.KNOWLEDGE_BASE_API.auth.algorithm` | `"RS256"` \| `"ES256"` \| `"HS256"` |  | `"RS256"` | Signing algorithm. |
| `externalApis.KNOWLEDGE_BASE_API.auth.claims` | object |  |  | Claims of the signed token. |
| `externalApis.KNOWLEDGE_BASE_API.auth.claims.iss` | string |  |  | `iss` claim. Omitted from the token when unset. |
| `externalApis.KNOWLEDGE_BASE_API.auth.claims.sub` | string |  |  | `sub` claim. Omitted from the token when unset. |
| `externalApis.KNOWLEDGE_BASE_API.auth.claims.aud` | one of (see below) |  |  | `aud` claim, one audience or a list. Omitted from the token when unset. |
| `externalApis.KNOWLEDGE_BASE_API.auth.claims.exp` | integer (> 0) |  | `3600` | Token lifetime in seconds. `iat` is always set. |
| `externalApis.KNOWLEDGE_BASE_API.auth.claims.additionalClaims` | object |  |  | Further claims added to the payload as given. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport` | object |  | `{"headers":[{"name":"Authorization","credential":"value","prefix":"Bearer "}]}` | Where the token goes. The credential is named `value`. Default: `Authorization: Bearer <token>`. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers` | array of one of (see below) |  |  | Headers to send. Each entry carries either a fixed `value` or a `credential`. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams` | array of one of (see below) |  |  | Query parameters to send. Each entry carries either a fixed `value` or a `credential`. |

##### `externalApis.KNOWLEDGE_BASE_API.auth.key`: one of 2

Pick the variant with `source`.

###### `externalApis.KNOWLEDGE_BASE_API.auth.key` — `source: "file"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.KNOWLEDGE_BASE_API.auth.key.source` | `"file"` | yes |  | Key read from a file when a token is signed. |
| `externalApis.KNOWLEDGE_BASE_API.auth.key.path` | string | yes |  | Path of the key file. |

###### `externalApis.KNOWLEDGE_BASE_API.auth.key` — `source: "value"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.KNOWLEDGE_BASE_API.auth.key.source` | `"value"` | yes |  | Key carried in the configuration itself. |
| `externalApis.KNOWLEDGE_BASE_API.auth.key.value` | string | yes |  | The key: an HMAC secret for HS256, otherwise a PEM-encoded PKCS#8 private key. |

##### `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers[]`

Same shapes as described above, first listed under `externalApis.KNOWLEDGE_BASE_API.auth — strategy: "kubernetes-service-account"`.

##### `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams[]`

Same shapes as described above, first listed under `externalApis.KNOWLEDGE_BASE_API.auth — strategy: "kubernetes-service-account"`.

#### `externalApis.KNOWLEDGE_BASE_API.auth` — `strategy: "none"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.KNOWLEDGE_BASE_API.auth.strategy` | `"none"` |  |  | No credential is produced. Fixed headers or query parameters may still be sent through `transport`. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport` | object |  |  | Fixed headers and query parameters, e.g. an API key. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers` | array of object |  |  | Fixed headers to send. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.headers[].value` | string | yes |  | Fixed value sent as is. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams` | array of object |  |  | Fixed query parameters to send. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.KNOWLEDGE_BASE_API.auth.transport.queryParams[].value` | string | yes |  | Fixed value sent as is. |

## mcpServers

The MCP endpoints this app mounts, one per entry, each serving one knowledge base. At least one entry; `name` and `path` unique.

Required.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `mcpServers` | array of object (at least 1 item) | yes |  | The MCP endpoints this app mounts, one per entry, each serving one knowledge base. At least one entry; `name` and `path` unique. |
| `mcpServers[].path` | string (starts_with, pattern `^\/.*`) | yes |  | Mount path of the endpoint in the app, e.g. `/development`. The public URL adds the route prefix (`/kb`), which Traefik strips before the request arrives. |
| `mcpServers[].kb` | string (non-empty) | yes |  | The knowledge base this endpoint serves: its id in knowledge-base-api, e.g. `development`. The endpoint is its knowledge base; a caller never chooses one. |
| `mcpServers[].name` | string (non-empty) | yes |  | Machine name clients see in `serverInfo.name`. Also identifies the endpoint in logs, refusals and auth, so it is unique across `mcpServers`. |
| `mcpServers[].title` | string (non-empty) | yes |  | Human-readable name clients show. |
| `mcpServers[].description` | string (non-empty) |  |  | What the server is for. Defaults to the package description. |
| `mcpServers[].instructions` | string (non-empty) |  |  | The MCP server `instructions` clients hand their agent: how to use this knowledge base. Defaults to `DEFAULT_INSTRUCTIONS` — search first, call `conventions` before writing or preparing files, approve writes. |
| `mcpServers[].auth` | one of (see below) | yes |  | Who may call the endpoint, by `type`: `oauth` (the default when `type` is absent) or `unauthenticated`. Required: an endpoint is never open by omission. |
| `mcpServers[].search` | object |  |  | How the endpoint searches: limits, embedding model and RRF weights. Absent: `DEFAULT_SEARCH_CONFIG`. A second endpoint on the same `kb` with other settings is how an alternative is tried side by side. |
| `mcpServers[].search.defaultLimit` | integer (≥ 1, ≤ 50) |  | `8` | Hits returned when the agent gives no `limit`. |
| `mcpServers[].search.maxLimit` | integer (≥ 1, ≤ 50) |  | `50` | The most hits an agent gets: a larger `limit` is lowered to this. At most 50, the API's own cap. |
| `mcpServers[].search.model` | string (non-empty) |  |  | Embedding model that answers the vector leg. Unset: the knowledge base's first configured model. |
| `mcpServers[].search.weights` | object |  | `{}` | RRF weights, always sent: they override the API's configured weights. |
| `mcpServers[].search.weights.vector` | number (≥ 0, ≤ 10) |  | `1` | RRF weight of the vector leg (0–10). |
| `mcpServers[].search.weights.fullText` | number (≥ 0, ≤ 10) |  | `0` | RRF weight of the full-text leg (0–10). |

### `mcpServers[].auth`: one of 2

Pick the variant with `type`.

#### `mcpServers[].auth` — `type: "oauth"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `mcpServers[].auth.type` | `"oauth"` |  | `"oauth"` | `oauth`, the default. |
| `mcpServers[].auth.issuer` | string (uri) | yes |  | The authorization server clients log in at: the shared client registration's Authentik issuer, e.g. `https://auth.irha.cz/application/o/knowledge-base-mcp-clients/`. Advertised in the Protected Resource Metadata, and the only `iss` a token may carry — compared exactly, trailing slash included. |
| `mcpServers[].auth.audience` | string (non-empty) | yes |  | The `aud` a token must carry: the endpoint's Authentik application for this environment, e.g. `knowledge-base-mcp-development-server1-production`. |
| `mcpServers[].auth.key` | one of (see below) | yes |  | Where the signing keys come from: the issuer's JWKS (`source: jwks`), or an inline key in tests. |
| `mcpServers[].auth.roles` | object | yes |  | The endpoint's Authentik role for each level, e.g. `{ READER: knowledge-base-mcp-development.reader, EDITOR: knowledge-base-mcp-development.editor }`. A token holding none of them is refused with 403; each tool then requires its own level. |
| `mcpServers[].auth.roles.READER` | string (non-empty) | yes |  | Authentik role that grants the `READER` level: the `search`, `read` and `conventions` tools. |
| `mcpServers[].auth.roles.EDITOR` | string (non-empty) | yes |  | Authentik role that grants the `EDITOR` level: the `create_note`, `write_document` and `delete_document` tools. |
| `mcpServers[].auth.scopes` | array of string (non-empty) |  | `["openid","profile","email","roles"]` | Scopes advertised in the metadata and in the 401 challenge, which is what a client asks Authentik for. |

##### `mcpServers[].auth.key`: one of 2

Pick the variant with `source`.

###### `mcpServers[].auth.key` — `source: "value"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `mcpServers[].auth.key.source` | `"value"` | yes |  | Inline key, carried in the configuration itself. |
| `mcpServers[].auth.key.algorithm` | string (non-empty) |  | `"HS256"` | Algorithm this key is for, and the only one accepted from this issuer. The `alg` in the token header is never trusted on its own. |
| `mcpServers[].auth.key.value` | string (non-empty) | yes |  | For `HS*`: the shared secret. Otherwise: a PEM-encoded public key. |

###### `mcpServers[].auth.key` — `source: "jwks"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `mcpServers[].auth.key.source` | `"jwks"` | yes |  | Keys fetched from a remote JWKS endpoint. |
| `mcpServers[].auth.key.uri` | string (uri) | yes |  | URL of the JWKS endpoint. |
| `mcpServers[].auth.key.auth` | `"none"` \| `"serviceAccountToken"` |  | `"none"` | Credential for the JWKS fetch itself. `serviceAccountToken` sends the pod's Kubernetes service account token, for the apiserver JWKS, which is not anonymously readable. |
| `mcpServers[].auth.key.algorithms` | array of string (non-empty) |  | `["RS256"]` | Signature algorithms accepted from this issuer (an allowlist). |
| `mcpServers[].auth.key.cacheTtlSeconds` | integer (> 0) |  | `300` | How long a fetched key set is reused, in seconds. |
| `mcpServers[].auth.key.refreshCooldownMs` | integer (> 0) |  | `30000` | Minimum time between two key set fetches, in ms, so tokens with an unknown `kid` cannot force a fetch per request. |
| `mcpServers[].auth.key.timeoutMs` | integer (> 0) |  | `3000` | Time limit for one JWKS fetch, in ms. |

#### `mcpServers[].auth` — `type: "unauthenticated"`

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `mcpServers[].auth.defaultSubject` | string (pattern `^[\w.@+-]{1,150}$`) | yes |  | Subject of the principal when no usable `subjectHeader` value arrives. |
| `mcpServers[].auth.subjectHeader` | string (non-empty) |  |  | Header whose value, when present and matching the subject pattern, becomes the subject (e.g. `X-User`). Unverified: a label for logs and attribution, never a basis for access. |
| `mcpServers[].auth.subjectKind` | `"human"` \| `"service"` \| `"device"` |  | `"human"` | Caller class of the principal. |
| `mcpServers[].auth.type` | `"unauthenticated"` | yes |  | `unauthenticated`: no sign-in. Trusted networks only. |
| `mcpServers[].auth.roles` | object |  | `{"READER":"knowledge-base-mcp.reader","EDITOR":"knowledge-base-mcp.editor"}` | The role each level maps to, as with `oauth`; every request holds all of them, so tools keep their per-level checks. Optional: absent grants every level. Leave out `EDITOR` for a read-only endpoint. |
| `mcpServers[].auth.roles.READER` | string (non-empty) |  |  | Authentik role that grants the `READER` level: the `search`, `read` and `conventions` tools. |
| `mcpServers[].auth.roles.EDITOR` | string (non-empty) |  |  | Authentik role that grants the `EDITOR` level: the `create_note`, `write_document` and `delete_document` tools. |

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
