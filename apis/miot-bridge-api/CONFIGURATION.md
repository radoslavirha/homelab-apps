# miot-bridge-api — configuration

<!-- Generated from the configuration schema. Do not edit by hand. -->

The service reads one JSON document (the `config` library: `config/<NODE_ENV>.json`; in a cluster, the mounted ConfigMap). It is validated at boot, and an invalid document stops the service. Keys not listed here are ignored.

**Required** means the key must be present whenever its parent is. A key with a default may be left out.

## Sections

| Section | Required | Description |
| --- | --- | --- |
| [`server`](#server) | yes | Ts.ED server settings. Keys other than httpPort are passed to the Ts.ED server configuration unchanged. |
| [`serviceName`](#servicename) |  | Service name. Defaults to the name in package.json. |
| [`publicURL`](#publicurl) |  | Public URL of the service, with protocol, host and path, when it is served behind a reverse proxy. |
| [`mongodb`](#mongodb) | yes | MongoDB configuration. MongoDB is the only storage; mongodb.enabled must be true. |
| [`polling`](#polling) |  | Device property polling configuration. When polling.enabled is true, subscribed properties are polled at the configured interval. |
| [`externalApis`](#externalapis) | yes | External APIs this service calls — base URL, auth, resilience and logging per API. |
| [`mqtt`](#mqtt) |  | MQTT client configuration. Connection is shared by the inbound command subscriber and outbound notification publisher. |
| [`health`](#health) |  | Health endpoint configuration. |
| [`logger`](#logger) |  | Logger configuration. `logger.requests.request.redactPaths` and `logger.requests.response.redactPaths` default to `["token","*.token","*.*.token"]` (the device secret), not the `[]` listed in the table; a configured list replaces that default and an explicit `[]` opts out. |
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
    "enabled": true,
    "url": "<string>"
  },
  "externalApis": {
    "MIOT_SPEC": {
      "baseURL": "https://example.com"
    }
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

MongoDB configuration. MongoDB is the only storage; mongodb.enabled must be true.

Required.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `mongodb.enabled` | `true` | yes |  | Must be `true`: MongoDB is the only storage. |
| `mongodb.url` | string | yes |  | MongoDB connection URL. |
| `mongodb.connectionOptions` | object |  |  | Additional MongoDB connection options. |

<details>
<summary><code>mongodb.connectionOptions</code> — Additional MongoDB connection options.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `mongodb.connectionOptions` | object |  |  | Additional MongoDB connection options. |
| `mongodb.connectionOptions.user` | string |  |  | Username for auth. |
| `mongodb.connectionOptions.pass` | string |  |  | Password for auth. |

</blockquote>
</details>

## polling

Device property polling configuration. When polling.enabled is true, subscribed properties are polled at the configured interval.

Optional.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `polling.enabled` | boolean |  | `true` | Set to `false` to disable. Keys marked required are required only when this is `true`. |
| `polling.intervalMs` | number |  | `15000` | Polling interval in milliseconds. |
| `polling.dispatchOnChange` | boolean |  | `true` | When true, a notification is dispatched only when a property value changes. When false, dispatched on every cycle. |
| `polling.maxErrorCount` | number |  | `3` | Number of consecutive device errors before the device is placed in back-off. |
| `polling.errorSkipCycles` | number |  | `20` | Number of polling cycles to skip for a device after it reaches maxErrorCount consecutive errors. |
| `polling.traceIntervalMs` | number |  |  | Minimum gap in milliseconds between two traced poll ticks. Ticks in between emit no spans at all. A tick polling a device that is mid-failure is always traced regardless. 0 traces every tick. Default: 60000. |

## externalApis

External APIs this service calls — base URL, auth, resilience and logging per API.

Required.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC` | object | yes |  | One external API: base URL, auth, resilience and outbound logging. |

<details>
<summary><code>externalApis.MIOT_SPEC</code> — One external API: base URL, auth, resilience and outbound logging.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC` | object | yes |  | One external API: base URL, auth, resilience and outbound logging. |
| `externalApis.MIOT_SPEC.baseURL` | string (uri) | yes |  | Base URL every request path is resolved against. |
| `externalApis.MIOT_SPEC.auth` | one of (see below) |  |  | How requests to this API are authenticated. Pick the variant with `strategy`; without `strategy` no credential is produced. |
| `externalApis.MIOT_SPEC.resilience` | object |  |  | Timeout, retry and circuit breaker for requests to this API. Omit to send requests without them. |
| `externalApis.MIOT_SPEC.retriableStatusCodes` | array of integer |  | `[500,502,503,504]` | HTTP statuses counted as transient failures, for retry and for the circuit breaker. |
| `externalApis.MIOT_SPEC.logging` | object |  | `{"enabled":true,"headers":{"enabled":false,"redactPaths":[]},"query":{"enabled":false,"redactPaths":[]},"request":{"enabled":false,"redactPaths":[]},"response":{"enabled":false,"redactPaths":[]},"stack":false}` | Outbound request logging. Metadata only by default; each payload section is opt-in and redacted before it reaches the logger. |

<details>
<summary><code>externalApis.MIOT_SPEC.auth</code>: one of 4</summary>
<blockquote>

Pick the variant with `strategy`.

<details>
<summary><code>externalApis.MIOT_SPEC.auth</code> — <code>strategy: "kubernetes-service-account"</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.strategy` | `"kubernetes-service-account"` | yes |  | Send the pod's Kubernetes service account token. The file is read on every request, so kubelet rotation is picked up. |
| `externalApis.MIOT_SPEC.auth.tokenPath` | string |  | `"/var/run/secrets/kubernetes.io/serviceaccount/token"` | Path of the projected service account token file. |
| `externalApis.MIOT_SPEC.auth.transport` | object |  | `{"headers":[{"name":"Authorization","credential":"value","prefix":"Bearer "}]}` | Where the token goes. The credential is named `value`. Default: `Authorization: Bearer <token>`. |

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport</code> — Where the token goes. The credential is named <code>value</code>. Default: <code>Authorization: Bearer &lt;token&gt;</code>.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport` | object |  | `{"headers":[{"name":"Authorization","credential":"value","prefix":"Bearer "}]}` | Where the token goes. The credential is named `value`. Default: `Authorization: Bearer <token>`. |
| `externalApis.MIOT_SPEC.auth.transport.headers` | array of one of (see below) |  |  | Headers to send. Each entry carries either a fixed `value` or a `credential`. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams` | array of one of (see below) |  |  | Query parameters to send. Each entry carries either a fixed `value` or a `credential`. |

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.headers[]</code>: one of 2</summary>
<blockquote>

Give exactly one of the shapes below.

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.headers[]</code> — with <code>credential</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport.headers[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.MIOT_SPEC.auth.transport.headers[].credential` | string (non-empty) | yes |  | Name of a credential the auth strategy produces: `value`, or for `token-exchange` an `as` name from `tokenExtractor`. |
| `externalApis.MIOT_SPEC.auth.transport.headers[].prefix` | string |  |  | Text put before the credential, e.g. `Bearer `. |
| `externalApis.MIOT_SPEC.auth.transport.headers[].suffix` | string |  |  | Text put after the credential. |

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.headers[]</code> — with <code>value</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport.headers[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.MIOT_SPEC.auth.transport.headers[].value` | string | yes |  | Fixed value sent as is. |

</blockquote>
</details>

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.queryParams[]</code>: one of 2</summary>
<blockquote>

Give exactly one of the shapes below.

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.queryParams[]</code> — with <code>credential</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].credential` | string (non-empty) | yes |  | Name of a credential the auth strategy produces: `value`, or for `token-exchange` an `as` name from `tokenExtractor`. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].prefix` | string |  |  | Text put before the credential, e.g. `Bearer `. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].suffix` | string |  |  | Text put after the credential. |

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.queryParams[]</code> — with <code>value</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].value` | string | yes |  | Fixed value sent as is. |

</blockquote>
</details>

</blockquote>
</details>

</blockquote>
</details>

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth</code> — <code>strategy: "token-exchange"</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.strategy` | `"token-exchange"` | yes |  | Fetch a token from a token endpoint and cache it; a 401 from the upstream drops the cache and the next request fetches a new one. |
| `externalApis.MIOT_SPEC.auth.request` | object | yes |  | The token request. |
| `externalApis.MIOT_SPEC.auth.tokenExtractor` | one of (see below) | yes |  | Which fields of the token response become credentials. A string is shorthand for one field stored as `value`; a list names each field and the credential name it is stored as. |
| `externalApis.MIOT_SPEC.auth.expiresIn` | string |  |  | Dot-notation path of the token lifetime in seconds in the token response (e.g. `expires_in`). Unset: the token is cached until the upstream answers 401. |
| `externalApis.MIOT_SPEC.auth.expiryMargin` | number (≥ 0) |  |  | Seconds before expiry at which a new token is fetched. Default 30. Used only with `expiresIn`. |
| `externalApis.MIOT_SPEC.auth.transport` | object | yes |  | Where the extracted credentials go. |

<details>
<summary><code>externalApis.MIOT_SPEC.auth.request</code> — The token request.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.request` | object | yes |  | The token request. |
| `externalApis.MIOT_SPEC.auth.request.method` | `"GET"` \| `"POST"` \| `"PUT"` \| `"PATCH"` |  | `"POST"` | HTTP method of the token request. |
| `externalApis.MIOT_SPEC.auth.request.url` | string (uri) | yes |  | URL of the token endpoint. |
| `externalApis.MIOT_SPEC.auth.request.headers` | array of object |  |  | Fixed headers sent with the token request. |
| `externalApis.MIOT_SPEC.auth.request.queryParams` | array of object |  |  | Fixed query parameters sent with the token request. |
| `externalApis.MIOT_SPEC.auth.request.body` | object |  |  | Request body of the token request, sent as given. |

<details>
<summary><code>externalApis.MIOT_SPEC.auth.request.headers[]</code> — Fixed headers sent with the token request.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.request.headers` | array of object |  |  | Fixed headers sent with the token request. |
| `externalApis.MIOT_SPEC.auth.request.headers[].name` | string | yes |  | Header or query parameter name. |
| `externalApis.MIOT_SPEC.auth.request.headers[].value` | string | yes |  | Fixed value sent as is. |

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth.request.queryParams[]</code> — Fixed query parameters sent with the token request.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.request.queryParams` | array of object |  |  | Fixed query parameters sent with the token request. |
| `externalApis.MIOT_SPEC.auth.request.queryParams[].name` | string | yes |  | Header or query parameter name. |
| `externalApis.MIOT_SPEC.auth.request.queryParams[].value` | string | yes |  | Fixed value sent as is. |

</blockquote>
</details>

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport</code> — Where the extracted credentials go.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport` | object | yes |  | Where the extracted credentials go. |
| `externalApis.MIOT_SPEC.auth.transport.headers` | array of one of (see below) |  |  | Headers to send. Each entry carries either a fixed `value` or a `credential`. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams` | array of one of (see below) |  |  | Query parameters to send. Each entry carries either a fixed `value` or a `credential`. |

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.headers[]</code>: one of 2</summary>
<blockquote>

Give exactly one of the shapes below.

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.headers[]</code> — with <code>credential</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport.headers[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.MIOT_SPEC.auth.transport.headers[].credential` | string (non-empty) | yes |  | Name of a credential the auth strategy produces: `value`, or for `token-exchange` an `as` name from `tokenExtractor`. |
| `externalApis.MIOT_SPEC.auth.transport.headers[].prefix` | string |  |  | Text put before the credential, e.g. `Bearer `. |
| `externalApis.MIOT_SPEC.auth.transport.headers[].suffix` | string |  |  | Text put after the credential. |

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.headers[]</code> — with <code>value</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport.headers[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.MIOT_SPEC.auth.transport.headers[].value` | string | yes |  | Fixed value sent as is. |

</blockquote>
</details>

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.queryParams[]</code>: one of 2</summary>
<blockquote>

Give exactly one of the shapes below.

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.queryParams[]</code> — with <code>credential</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].credential` | string (non-empty) | yes |  | Name of a credential the auth strategy produces: `value`, or for `token-exchange` an `as` name from `tokenExtractor`. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].prefix` | string |  |  | Text put before the credential, e.g. `Bearer `. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].suffix` | string |  |  | Text put after the credential. |

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.queryParams[]</code> — with <code>value</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].value` | string | yes |  | Fixed value sent as is. |

</blockquote>
</details>

</blockquote>
</details>

</blockquote>
</details>

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth</code> — <code>strategy: "jwt-self-signed"</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.strategy` | `"jwt-self-signed"` | yes |  | Sign a JWT locally and send it. The token is reused until shortly before it expires. |
| `externalApis.MIOT_SPEC.auth.key` | one of (see below) | yes |  | Signing key. |
| `externalApis.MIOT_SPEC.auth.algorithm` | `"RS256"` \| `"ES256"` \| `"HS256"` |  | `"RS256"` | Signing algorithm. |
| `externalApis.MIOT_SPEC.auth.claims` | object |  |  | Claims of the signed token. |
| `externalApis.MIOT_SPEC.auth.transport` | object |  | `{"headers":[{"name":"Authorization","credential":"value","prefix":"Bearer "}]}` | Where the token goes. The credential is named `value`. Default: `Authorization: Bearer <token>`. |

<details>
<summary><code>externalApis.MIOT_SPEC.auth.key</code>: one of 2</summary>
<blockquote>

Pick the variant with `source`.

<details>
<summary><code>externalApis.MIOT_SPEC.auth.key</code> — <code>source: "file"</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.key.source` | `"file"` | yes |  | Key read from a file when a token is signed. |
| `externalApis.MIOT_SPEC.auth.key.path` | string | yes |  | Path of the key file. |

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth.key</code> — <code>source: "value"</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.key.source` | `"value"` | yes |  | Key carried in the configuration itself. |
| `externalApis.MIOT_SPEC.auth.key.value` | string | yes |  | The key: an HMAC secret for HS256, otherwise a PEM-encoded PKCS#8 private key. |

</blockquote>
</details>

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth.claims</code> — Claims of the signed token.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.claims` | object |  |  | Claims of the signed token. |
| `externalApis.MIOT_SPEC.auth.claims.iss` | string |  |  | `iss` claim. Omitted from the token when unset. |
| `externalApis.MIOT_SPEC.auth.claims.sub` | string |  |  | `sub` claim. Omitted from the token when unset. |
| `externalApis.MIOT_SPEC.auth.claims.aud` | one of (see below) |  |  | `aud` claim, one audience or a list. Omitted from the token when unset. |
| `externalApis.MIOT_SPEC.auth.claims.exp` | integer (> 0) |  | `3600` | Token lifetime in seconds. `iat` is always set. |
| `externalApis.MIOT_SPEC.auth.claims.additionalClaims` | object |  |  | Further claims added to the payload as given. |

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport</code> — Where the token goes. The credential is named <code>value</code>. Default: <code>Authorization: Bearer &lt;token&gt;</code>.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport` | object |  | `{"headers":[{"name":"Authorization","credential":"value","prefix":"Bearer "}]}` | Where the token goes. The credential is named `value`. Default: `Authorization: Bearer <token>`. |
| `externalApis.MIOT_SPEC.auth.transport.headers` | array of one of (see below) |  |  | Headers to send. Each entry carries either a fixed `value` or a `credential`. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams` | array of one of (see below) |  |  | Query parameters to send. Each entry carries either a fixed `value` or a `credential`. |

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.headers[]</code>: one of 2</summary>
<blockquote>

Give exactly one of the shapes below.

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.headers[]</code> — with <code>credential</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport.headers[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.MIOT_SPEC.auth.transport.headers[].credential` | string (non-empty) | yes |  | Name of a credential the auth strategy produces: `value`, or for `token-exchange` an `as` name from `tokenExtractor`. |
| `externalApis.MIOT_SPEC.auth.transport.headers[].prefix` | string |  |  | Text put before the credential, e.g. `Bearer `. |
| `externalApis.MIOT_SPEC.auth.transport.headers[].suffix` | string |  |  | Text put after the credential. |

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.headers[]</code> — with <code>value</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport.headers[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.MIOT_SPEC.auth.transport.headers[].value` | string | yes |  | Fixed value sent as is. |

</blockquote>
</details>

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.queryParams[]</code>: one of 2</summary>
<blockquote>

Give exactly one of the shapes below.

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.queryParams[]</code> — with <code>credential</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].credential` | string (non-empty) | yes |  | Name of a credential the auth strategy produces: `value`, or for `token-exchange` an `as` name from `tokenExtractor`. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].prefix` | string |  |  | Text put before the credential, e.g. `Bearer `. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].suffix` | string |  |  | Text put after the credential. |

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.queryParams[]</code> — with <code>value</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].value` | string | yes |  | Fixed value sent as is. |

</blockquote>
</details>

</blockquote>
</details>

</blockquote>
</details>

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth</code> — <code>strategy: "none"</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.strategy` | `"none"` |  |  | No credential is produced. Fixed headers or query parameters may still be sent through `transport`. |
| `externalApis.MIOT_SPEC.auth.transport` | object |  |  | Fixed headers and query parameters, e.g. an API key. |

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport</code> — Fixed headers and query parameters, e.g. an API key.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport` | object |  |  | Fixed headers and query parameters, e.g. an API key. |
| `externalApis.MIOT_SPEC.auth.transport.headers` | array of object |  |  | Fixed headers to send. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams` | array of object |  |  | Fixed query parameters to send. |

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.headers[]</code> — Fixed headers to send.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport.headers` | array of object |  |  | Fixed headers to send. |
| `externalApis.MIOT_SPEC.auth.transport.headers[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.MIOT_SPEC.auth.transport.headers[].value` | string | yes |  | Fixed value sent as is. |

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.auth.transport.queryParams[]</code> — Fixed query parameters to send.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.auth.transport.queryParams` | array of object |  |  | Fixed query parameters to send. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].name` | string (non-empty) | yes |  | Header or query parameter name. |
| `externalApis.MIOT_SPEC.auth.transport.queryParams[].value` | string | yes |  | Fixed value sent as is. |

</blockquote>
</details>

</blockquote>
</details>

</blockquote>
</details>

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.resilience</code> — Timeout, retry and circuit breaker for requests to this API. Omit to send requests without them.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.resilience` | object |  |  | Timeout, retry and circuit breaker for requests to this API. Omit to send requests without them. |
| `externalApis.MIOT_SPEC.resilience.timeout` | object |  |  | Per-attempt timeout. Omit to disable. |
| `externalApis.MIOT_SPEC.resilience.retry` | object |  |  | Retry policy. Omit to disable. Retries wrap the circuit breaker and the timeout, so each attempt gets its own timeout. |
| `externalApis.MIOT_SPEC.resilience.circuitBreaker` | object |  |  | Sampling circuit breaker. Omit to disable; `{}` enables it with the defaults. |

<details>
<summary><code>externalApis.MIOT_SPEC.resilience.timeout</code> — Per-attempt timeout. Omit to disable.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.resilience.timeout` | object |  |  | Per-attempt timeout. Omit to disable. |
| `externalApis.MIOT_SPEC.resilience.timeout.ms` | integer (≥ 0) |  | `5000` | Time limit for one attempt, in ms. When it runs out the attempt is aborted through its AbortSignal and rejects. |

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.resilience.retry</code> — Retry policy. Omit to disable. Retries wrap the circuit breaker and the timeout, so each attempt gets its own timeout.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.resilience.retry` | object |  |  | Retry policy. Omit to disable. Retries wrap the circuit breaker and the timeout, so each attempt gets its own timeout. |
| `externalApis.MIOT_SPEC.resilience.retry.count` | integer (≥ 0) |  | `0` | Additional attempts after the first one. `0` disables retry. |
| `externalApis.MIOT_SPEC.resilience.retry.backoffMs` | integer (≥ 0) |  | `250` | Constant delay between attempts, in ms. |

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.resilience.circuitBreaker</code> — Sampling circuit breaker. Omit to disable; <code>{}</code> enables it with the defaults.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.resilience.circuitBreaker` | object |  |  | Sampling circuit breaker. Omit to disable; `{}` enables it with the defaults. |
| `externalApis.MIOT_SPEC.resilience.circuitBreaker.halfOpenAfterMs` | integer (≥ 0) |  | `10000` | How long the circuit stays open, in ms, before one trial call is let through (half-open). |
| `externalApis.MIOT_SPEC.resilience.circuitBreaker.threshold` | number (> 0, < 1) |  | `0.5` | Error ratio over the sampling window above which the circuit opens. |
| `externalApis.MIOT_SPEC.resilience.circuitBreaker.samplingDurationMs` | integer (≥ 1) |  | `10000` | Length of the trailing window the error ratio is measured over, in ms. |
| `externalApis.MIOT_SPEC.resilience.circuitBreaker.minimumThroughput` | integer (≥ 1) |  | `5` | Calls per second the window must average before the circuit may open at all. |

</blockquote>
</details>

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.logging</code> — Outbound request logging. Metadata only by default; each payload section is opt-in and redacted before it reaches the logger.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.logging` | object |  | `{"enabled":true,"headers":{"enabled":false,"redactPaths":[]},"query":{"enabled":false,"redactPaths":[]},"request":{"enabled":false,"redactPaths":[]},"response":{"enabled":false,"redactPaths":[]},"stack":false}` | Outbound request logging. Metadata only by default; each payload section is opt-in and redacted before it reaches the logger. |
| `externalApis.MIOT_SPEC.logging.headers` | object |  |  | Request headers. The names of the transport headers the auth config sends are always added to `redactPaths`. |
| `externalApis.MIOT_SPEC.logging.query` | object |  |  | Query parameters. The names of the transport query parameters the auth config sends are always added to `redactPaths`. |
| `externalApis.MIOT_SPEC.logging.request` | object |  |  | Request body. |
| `externalApis.MIOT_SPEC.logging.response` | object |  |  | Response body. |
| `externalApis.MIOT_SPEC.logging.enabled` | boolean |  | `true` | Log outbound requests. `false` turns the logging off entirely. |
| `externalApis.MIOT_SPEC.logging.stack` | boolean |  | `false` | Include the error stack when a request fails. |

<details>
<summary><code>externalApis.MIOT_SPEC.logging.headers</code> — Request headers. The names of the transport headers the auth config sends are always added to <code>redactPaths</code>.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.logging.headers` | object |  |  | Request headers. The names of the transport headers the auth config sends are always added to `redactPaths`. |
| `externalApis.MIOT_SPEC.logging.headers.enabled` | boolean |  | `false` | Log this section. Off unless switched on. |
| `externalApis.MIOT_SPEC.logging.headers.redactPaths` | array of string (non-empty) |  | `["authorization","Authorization","cookie","Cookie","[\"set-cookie\"]","[\"proxy-authorization\"]","[\"x-api-key\"]"]` | Paths whose values are censored before logging (`fast-redact` syntax; hyphenated names in bracket notation, e.g. `["x-api-key"]`). |

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.logging.query</code> — Query parameters. The names of the transport query parameters the auth config sends are always added to <code>redactPaths</code>.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.logging.query` | object |  |  | Query parameters. The names of the transport query parameters the auth config sends are always added to `redactPaths`. |
| `externalApis.MIOT_SPEC.logging.query.enabled` | boolean |  | `false` | Log this section. Off unless switched on. |
| `externalApis.MIOT_SPEC.logging.query.redactPaths` | array of string (non-empty) |  | `[]` | Paths whose values are censored before logging (`fast-redact` syntax; hyphenated names in bracket notation, e.g. `["x-api-key"]`). |

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.logging.request</code> — Request body.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.logging.request` | object |  |  | Request body. |
| `externalApis.MIOT_SPEC.logging.request.enabled` | boolean |  | `false` | Log this section. Off unless switched on. |
| `externalApis.MIOT_SPEC.logging.request.redactPaths` | array of string (non-empty) |  | `[]` | Paths whose values are censored before logging (`fast-redact` syntax; hyphenated names in bracket notation, e.g. `["x-api-key"]`). |

</blockquote>
</details>

<details>
<summary><code>externalApis.MIOT_SPEC.logging.response</code> — Response body.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `externalApis.MIOT_SPEC.logging.response` | object |  |  | Response body. |
| `externalApis.MIOT_SPEC.logging.response.enabled` | boolean |  | `false` | Log this section. Off unless switched on. |
| `externalApis.MIOT_SPEC.logging.response.redactPaths` | array of string (non-empty) |  | `[]` | Paths whose values are censored before logging (`fast-redact` syntax; hyphenated names in bracket notation, e.g. `["x-api-key"]`). |

</blockquote>
</details>

</blockquote>
</details>

</blockquote>
</details>

## mqtt

MQTT client configuration. Connection is shared by the inbound command subscriber and outbound notification publisher.

Optional.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `mqtt.enabled` | boolean | yes |  | Set to `false` to disable. Keys marked required are required only when this is `true`. |
| `mqtt.url` | string | yes |  | Full broker URL, e.g. "mqtt://localhost:1883" or "mqtts://broker.example.com:8883". |
| `mqtt.clientId` | string |  |  | MQTT client identifier. Defaults to a random ID generated by the broker. |
| `mqtt.username` | string | yes |  | Username for broker authentication. For EMQX, this is the API Key. |
| `mqtt.password` | string | yes |  | Password for broker authentication. For EMQX, this is the Secret Key. |
| `mqtt.topicPrefix` | string |  |  | Optional prefix prepended to all MQTT topics, separated by "/". For example "home/office" produces topics like "home/office/miot-bridge/command". |
| `mqtt.notifications` | object |  |  | MQTT notification settings. |

<details>
<summary><code>mqtt.notifications</code> — MQTT notification settings.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `mqtt.notifications` | object |  |  | MQTT notification settings. |
| `mqtt.notifications.enabled` | boolean |  |  | Whether MQTT outbound notifications are enabled. |
| `mqtt.notifications.publishIntervalMs` | integer (≥ 0) |  |  | Minimum gap in milliseconds between two notification publishes. A burst is queued and sent one message at a time. 0 sends every message immediately while connected. Messages wait while the client is offline. Keep it above 2000 for Loxone, which processes only the newest message per 2 s. Default: 3000. |

</blockquote>
</details>

## health

Health endpoint configuration.

Optional.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `health.checkTimeoutMs` | integer (≥ 1, ≤ 2147483647) |  | `2000` | Deadline per health check, in ms. A check that takes longer reports `fail` with detail `timeout`. Keep it below the readiness probe timeoutSeconds. |
| `health.cacheTtlMs` | integer (≥ 0) |  | `1000` | How long an evaluated result is reused, in ms, so concurrent and closely spaced probes share one evaluation. `0` disables reuse. |
| `health.exposeDetail` | boolean |  | `true` | When `false`, `GET /health` returns the status alone, without the per-check breakdown. |

## logger

Logger configuration. `logger.requests.request.redactPaths` and `logger.requests.response.redactPaths` default to `["token","*.token","*.*.token"]` (the device secret), not the `[]` listed in the table; a configured list replaces that default and an explicit `[]` opts out.

Optional. Default `{}`.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `logger.enabled` | boolean |  | `true` | Write logs at all. `false` silences every log call, application and HTTP request logs alike. |
| `logger.level` | `"fatal"` \| `"error"` \| `"warn"` \| `"info"` \| `"debug"` \| `"trace"` |  | `"info"` | Logging level. |
| `logger.requests` | object |  | `{}` | HTTP request logging: one entry per handled request under scope `HTTP_REQUEST`, written when the response finishes, with `reqId`, `method`, `url`, `status` and `duration` (ms). Status below 400 logs `info` "Request completed"; 400 and above logs `error` "Request failed" with the error fields. |

<details>
<summary><code>logger.requests</code> — HTTP request logging: one entry per handled request under scope <code>HTTP_REQUEST</code>, written when the response finishes, with <code>reqId</code>, <code>method</code>, <code>url</code>, <code>status</code> and <code>duration</code> (ms). Status below 400 logs <code>info</code> "Request completed"; 400 and above logs <code>error</code> "Request failed" with the error fields.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `logger.requests` | object |  | `{}` | HTTP request logging: one entry per handled request under scope `HTTP_REQUEST`, written when the response finishes, with `reqId`, `method`, `url`, `status` and `duration` (ms). Status below 400 logs `info` "Request completed"; 400 and above logs `error` "Request failed" with the error fields. |
| `logger.requests.enabled` | boolean |  | `true` | Write one log entry per handled HTTP request. `false` stops request logging only; application log calls are unaffected. |
| `logger.requests.headers` | object |  |  | Request headers, logged as `headers`. Credential headers (`authorization`, `cookie`, `set-cookie`, `proxy-authorization`, `x-api-key`) are redacted by default; a configured `redactPaths` replaces that list, so `[]` logs them raw. |
| `logger.requests.query` | object |  |  | Parsed query-string parameters, logged as `query`. The logged `url` never carries the query string. |
| `logger.requests.request` | object |  |  | Request body, logged as `request`. Bodies with a text content type (none, `text/*`, JSON, XML, GraphQL, JavaScript, form-urlencoded, `+json`, `+xml`) are logged; any other body is logged as `[[ BINARY ]]`. |
| `logger.requests.response` | object |  |  | Response body, logged as `response`, after the same Ts.ED serialisation the client receives, so `redactPaths` match wire names. A non-text content type is logged as `[[ BINARY ]]`; a body that cannot be serialised, as `[[ UNSERIALIZABLE ]]`. |
| `logger.requests.stack` | boolean |  | `true` | Add `error_stack` to the entry of a failed request (status 400 or above) when the thrown value is an `Error` or has a string `message`. |
| `logger.requests.ignorePaths` | array of string |  | `["/health","/healthz"]` | Request paths that get no log entry. Each is a case-sensitive prefix matched on whole path segments against the path without its query string: `/health` matches `/health` and `/health/live`, not `/healthcheck`. A trailing slash is ignored, so `/` matches every path. |

<details>
<summary><code>logger.requests.headers</code> — Request headers, logged as <code>headers</code>. Credential headers (<code>authorization</code>, <code>cookie</code>, <code>set-cookie</code>, <code>proxy-authorization</code>, <code>x-api-key</code>) are redacted by default; a configured <code>redactPaths</code> replaces that list, so <code>[]</code> logs them raw.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `logger.requests.headers` | object |  |  | Request headers, logged as `headers`. Credential headers (`authorization`, `cookie`, `set-cookie`, `proxy-authorization`, `x-api-key`) are redacted by default; a configured `redactPaths` replaces that list, so `[]` logs them raw. |
| `logger.requests.headers.enabled` | boolean |  | `true` | Include this field in the output. `false` omits the field entirely; it never means logging it unredacted. |
| `logger.requests.headers.redactPaths` | array of string (non-empty) |  | `["authorization","cookie","[\"set-cookie\"]","[\"proxy-authorization\"]","[\"x-api-key\"]"]` | Path selectors whose values are replaced with `***` before the field is written: `token` (root key), `user.password` (nested path), `items.*.token` (wildcard), `["set-cookie"]` (bracket form, required for names that are not identifiers, such as ones with a hyphen). A configured list replaces the default; it is never merged with it, and `[]` redacts nothing. |

</blockquote>
</details>

<details>
<summary><code>logger.requests.query</code> — Parsed query-string parameters, logged as <code>query</code>. The logged <code>url</code> never carries the query string.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `logger.requests.query` | object |  |  | Parsed query-string parameters, logged as `query`. The logged `url` never carries the query string. |
| `logger.requests.query.enabled` | boolean |  | `true` | Include this field in the output. `false` omits the field entirely; it never means logging it unredacted. |
| `logger.requests.query.redactPaths` | array of string (non-empty) |  | `[]` | Path selectors whose values are replaced with `***` before the field is written: `token` (root key), `user.password` (nested path), `items.*.token` (wildcard), `["set-cookie"]` (bracket form, required for names that are not identifiers, such as ones with a hyphen). A configured list replaces the default; it is never merged with it, and `[]` redacts nothing. |

</blockquote>
</details>

<details>
<summary><code>logger.requests.request</code> — Request body, logged as <code>request</code>. Bodies with a text content type (none, <code>text/*</code>, JSON, XML, GraphQL, JavaScript, form-urlencoded, <code>+json</code>, <code>+xml</code>) are logged; any other body is logged as <code>[[ BINARY ]]</code>.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `logger.requests.request` | object |  |  | Request body, logged as `request`. Bodies with a text content type (none, `text/*`, JSON, XML, GraphQL, JavaScript, form-urlencoded, `+json`, `+xml`) are logged; any other body is logged as `[[ BINARY ]]`. |
| `logger.requests.request.enabled` | boolean |  | `true` | Include this field in the output. `false` omits the field entirely; it never means logging it unredacted. |
| `logger.requests.request.redactPaths` | array of string (non-empty) |  | `[]` | Path selectors whose values are replaced with `***` before the field is written: `token` (root key), `user.password` (nested path), `items.*.token` (wildcard), `["set-cookie"]` (bracket form, required for names that are not identifiers, such as ones with a hyphen). A configured list replaces the default; it is never merged with it, and `[]` redacts nothing. |

</blockquote>
</details>

<details>
<summary><code>logger.requests.response</code> — Response body, logged as <code>response</code>, after the same Ts.ED serialisation the client receives, so <code>redactPaths</code> match wire names. A non-text content type is logged as <code>[[ BINARY ]]</code>; a body that cannot be serialised, as <code>[[ UNSERIALIZABLE ]]</code>.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `logger.requests.response` | object |  |  | Response body, logged as `response`, after the same Ts.ED serialisation the client receives, so `redactPaths` match wire names. A non-text content type is logged as `[[ BINARY ]]`; a body that cannot be serialised, as `[[ UNSERIALIZABLE ]]`. |
| `logger.requests.response.enabled` | boolean |  | `true` | Include this field in the output. `false` omits the field entirely; it never means logging it unredacted. |
| `logger.requests.response.redactPaths` | array of string (non-empty) |  | `[]` | Path selectors whose values are replaced with `***` before the field is written: `token` (root key), `user.password` (nested path), `items.*.token` (wildcard), `["set-cookie"]` (bracket form, required for names that are not identifiers, such as ones with a hyphen). A configured list replaces the default; it is never merged with it, and `[]` redacts nothing. |

</blockquote>
</details>

</blockquote>
</details>

## otel

OpenTelemetry configuration.

Optional.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `otel.debug` | boolean |  |  | Enable OTEL SDK debug logging via DiagConsoleLogger. |
| `otel.resourceAttributes` | map of name → string \| number \| boolean |  |  | Extra resource attributes on every span, metric and log record, e.g. `{ "deployment.environment.name": "production" }`. Values are strings, numbers or booleans. `service.name` and `service.version` are not allowed. |
| `otel.traces` | object |  |  | Trace export over OTLP/HTTP (batched). Omitted or disabled: no traces are exported. |
| `otel.metrics` | object |  |  | Metric export over OTLP/HTTP (periodic). Omitted or disabled: no metrics are exported. |
| `otel.logs` | object |  |  | Log record export over OTLP/HTTP (batched). Omitted or disabled: no log records are exported. |

<details>
<summary><code>otel.traces</code> — Trace export over OTLP/HTTP (batched). Omitted or disabled: no traces are exported.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `otel.traces` | object |  |  | Trace export over OTLP/HTTP (batched). Omitted or disabled: no traces are exported. |
| `otel.traces.enabled` | boolean | yes |  | Set to `false` to disable. Keys marked required are required only when this is `true`. |
| `otel.traces.exporter` | object | yes |  | OTLP/HTTP exporter configuration. Required when traces are enabled. |

<details>
<summary><code>otel.traces.exporter</code> — OTLP/HTTP exporter configuration. Required when traces are enabled.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `otel.traces.exporter` | object | yes |  | OTLP/HTTP exporter configuration. Required when traces are enabled. |
| `otel.traces.exporter.url` | string | yes |  | OTLP/HTTP exporter endpoint URL. |

</blockquote>
</details>

</blockquote>
</details>

<details>
<summary><code>otel.metrics</code> — Metric export over OTLP/HTTP (periodic). Omitted or disabled: no metrics are exported.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `otel.metrics` | object |  |  | Metric export over OTLP/HTTP (periodic). Omitted or disabled: no metrics are exported. |
| `otel.metrics.enabled` | boolean | yes |  | Set to `false` to disable. Keys marked required are required only when this is `true`. |
| `otel.metrics.exporter` | object | yes |  | OTLP/HTTP exporter configuration. Required when metrics are enabled. |

<details>
<summary><code>otel.metrics.exporter</code> — OTLP/HTTP exporter configuration. Required when metrics are enabled.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `otel.metrics.exporter` | object | yes |  | OTLP/HTTP exporter configuration. Required when metrics are enabled. |
| `otel.metrics.exporter.url` | string | yes |  | OTLP/HTTP exporter endpoint URL. |

</blockquote>
</details>

</blockquote>
</details>

<details>
<summary><code>otel.logs</code> — Log record export over OTLP/HTTP (batched). Omitted or disabled: no log records are exported.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `otel.logs` | object |  |  | Log record export over OTLP/HTTP (batched). Omitted or disabled: no log records are exported. |
| `otel.logs.enabled` | boolean | yes |  | Set to `false` to disable. Keys marked required are required only when this is `true`. |
| `otel.logs.exporter` | object | yes |  | OTLP/HTTP exporter configuration. Required when logs are enabled. |

<details>
<summary><code>otel.logs.exporter</code> — OTLP/HTTP exporter configuration. Required when logs are enabled.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `otel.logs.exporter` | object | yes |  | OTLP/HTTP exporter configuration. Required when logs are enabled. |
| `otel.logs.exporter.url` | string | yes |  | OTLP/HTTP exporter endpoint URL. |

</blockquote>
</details>

</blockquote>
</details>

## auth

Authentication configuration.

Required.

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `auth.IDP` | one of (see below) | yes |  | How callers of the routes guarded by this method are verified. |

<details>
<summary><code>auth.IDP</code>: one of 2</summary>
<blockquote>

Pick the variant with `type`.

<details>
<summary><code>auth.IDP</code> — <code>type: "bearer-jwt"</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `auth.IDP.type` | `"bearer-jwt"` | yes |  | Verify a bearer JWT from the `Authorization` header. |
| `auth.IDP.trustedIssuers` | array of object (at least 1 item) | yes |  | Issuers whose tokens are accepted. At least one; each `issuer` at most once. A token is matched to a row by its `iss`. |

<details>
<summary><code>auth.IDP.trustedIssuers[]</code> — Issuers whose tokens are accepted. At least one; each <code>issuer</code> at most once. A token is matched to a row by its <code>iss</code>.</summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `auth.IDP.trustedIssuers` | array of object (at least 1 item) | yes |  | Issuers whose tokens are accepted. At least one; each `issuer` at most once. A token is matched to a row by its `iss`. |
| `auth.IDP.trustedIssuers[].name` | string (non-empty) | yes |  | Label for this issuer in the boot log. Not matched against anything. |
| `auth.IDP.trustedIssuers[].issuer` | string (non-empty) | yes |  | Exact `iss` value to match, compared as a string. Never normalised: a trailing slash matters. |
| `auth.IDP.trustedIssuers[].audience` | string (non-empty) | yes |  | Audience (`aud`) this service answers to. Tokens minted for another audience are refused. |
| `auth.IDP.trustedIssuers[].key` | one of (see below) | yes |  | Key that verifies token signatures from this issuer. |
| `auth.IDP.trustedIssuers[].subjectKind` | `"human"` \| `"service"` \| `"device"` |  | `"human"` | Caller class that tokens from this issuer represent, stamped onto the principal. |
| `auth.IDP.trustedIssuers[].rolesClaim` | string |  | `"roles"` | Token claim the roles are read from. A token without it has no roles. |

<details>
<summary><code>auth.IDP.trustedIssuers[].key</code>: one of 2</summary>
<blockquote>

Pick the variant with `source`.

<details>
<summary><code>auth.IDP.trustedIssuers[].key</code> — <code>source: "value"</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `auth.IDP.trustedIssuers[].key.source` | `"value"` | yes |  | Inline key, carried in the configuration itself. |
| `auth.IDP.trustedIssuers[].key.algorithm` | string (non-empty) |  | `"HS256"` | Algorithm this key is for, and the only one accepted from this issuer. The `alg` in the token header is never trusted on its own. |
| `auth.IDP.trustedIssuers[].key.value` | string (non-empty) | yes |  | For `HS*`: the shared secret. Otherwise: a PEM-encoded public key. |

</blockquote>
</details>

<details>
<summary><code>auth.IDP.trustedIssuers[].key</code> — <code>source: "jwks"</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `auth.IDP.trustedIssuers[].key.source` | `"jwks"` | yes |  | Keys fetched from a remote JWKS endpoint. |
| `auth.IDP.trustedIssuers[].key.uri` | string (uri) | yes |  | URL of the JWKS endpoint. |
| `auth.IDP.trustedIssuers[].key.auth` | `"none"` \| `"serviceAccountToken"` |  | `"none"` | Credential for the JWKS fetch itself. `serviceAccountToken` sends the pod's Kubernetes service account token, for the apiserver JWKS, which is not anonymously readable. |
| `auth.IDP.trustedIssuers[].key.algorithms` | array of string (non-empty) |  | `["RS256"]` | Signature algorithms accepted from this issuer (an allowlist). |
| `auth.IDP.trustedIssuers[].key.cacheTtlSeconds` | integer (> 0) |  | `300` | How long a fetched key set is reused, in seconds. |
| `auth.IDP.trustedIssuers[].key.refreshCooldownMs` | integer (> 0) |  | `30000` | Minimum time between two key set fetches, in ms, so tokens with an unknown `kid` cannot force a fetch per request. |
| `auth.IDP.trustedIssuers[].key.timeoutMs` | integer (> 0) |  | `3000` | Time limit for one JWKS fetch, in ms. |

</blockquote>
</details>

</blockquote>
</details>

</blockquote>
</details>

</blockquote>
</details>

<details>
<summary><code>auth.IDP</code> — <code>type: "unauthenticated"</code></summary>
<blockquote>

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `auth.IDP.type` | `"unauthenticated"` | yes |  | No credential is checked: every request is admitted as one principal holding all of `roles`. Meant for testing without an IdP; the boot log warns about it. |
| `auth.IDP.roles` | array of string (non-empty) (at least 1 item) | yes |  | Roles every request is given. At least one. |
| `auth.IDP.defaultSubject` | string (pattern `^[\w.@+-]{1,150}$`) | yes |  | Subject of the principal when no usable `subjectHeader` value arrives. |
| `auth.IDP.subjectHeader` | string (non-empty) |  |  | Header whose value, when present and matching the subject pattern, becomes the subject (e.g. `X-User`). Unverified: a label for logs and attribution, never a basis for access. |
| `auth.IDP.subjectKind` | `"human"` \| `"service"` \| `"device"` |  | `"human"` | Caller class of the principal. |

</blockquote>
</details>

</blockquote>
</details>
