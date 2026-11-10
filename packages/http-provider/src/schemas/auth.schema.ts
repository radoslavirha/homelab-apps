import { z } from 'zod';
import { StaticTransportSchema, TransportSchema } from './transport.schema.js';

export enum AuthStrategy {
    None = 'none',
    KubernetesServiceAccount = 'kubernetes-service-account',
    TokenExchange = 'token-exchange',
    JwtSelfSigned = 'jwt-self-signed'
}

// ─── Kubernetes Service Account ──────────────────────────────────────────────

const K8S_DEFAULT_TOKEN_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/token';

const K8S_DEFAULT_TRANSPORT = {
    headers: [{ name: 'Authorization', credential: 'value', prefix: 'Bearer ' }]
};

export const KubernetesServiceAccountAuthSchema = z.object({
    strategy: z.literal(AuthStrategy.KubernetesServiceAccount)
        .describe('Send the pod\'s Kubernetes service account token. The file is read on every request, so kubelet rotation is picked up.'),
    tokenPath: z.string().default(K8S_DEFAULT_TOKEN_PATH)
        .describe('Path of the projected service account token file.'),
    transport: TransportSchema.default(K8S_DEFAULT_TRANSPORT)
        .describe('Where the token goes. The credential is named `value`. Default: `Authorization: Bearer <token>`.')
});

// ─── Token Exchange ───────────────────────────────────────────────────────────

export const TokenExtractorEntrySchema = z.object({
    field: z.string().describe('Dot-notation path of a string in the token response (e.g. `access_token`, `data.token`).'),
    as: z.string().describe('Credential name a transport entry refers to in its `credential`.')
});

const TokenExtractorSchema = z.union([
    z.string().transform((s): z.infer<typeof TokenExtractorEntrySchema>[] => [{ field: s, as: 'value' }]),
    z.array(TokenExtractorEntrySchema)
]);

const TokenRequestParamSchema = z.object({
    name: z.string().describe('Header or query parameter name.'),
    value: z.string().describe('Fixed value sent as is.')
});

export const TokenExchangeRequestSchema = z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH']).default('POST').describe('HTTP method of the token request.'),
    url: z.url().describe('URL of the token endpoint.'),
    headers: z.array(TokenRequestParamSchema).optional()
        .describe('Fixed headers sent with the token request.'),
    queryParams: z.array(TokenRequestParamSchema).optional()
        .describe('Fixed query parameters sent with the token request.'),
    body: z.record(z.string(), z.unknown()).optional()
        .describe('Request body of the token request, sent as given.')
});

export const TokenExchangeAuthSchema = z.object({
    strategy: z.literal(AuthStrategy.TokenExchange)
        .describe('Fetch a token from a token endpoint and cache it; a 401 from the upstream drops the cache and the next request fetches a new one.'),
    request: TokenExchangeRequestSchema.describe('The token request.'),
    tokenExtractor: TokenExtractorSchema
        .describe('Which fields of the token response become credentials. A string is shorthand for one field stored as `value`; a list names each field and the credential name it is stored as.'),
    /** Dot-notation path to the token lifetime in seconds (`expires_in`). Unset: cache until the upstream answers 401. */
    expiresIn: z.string().optional()
        .describe('Dot-notation path of the token lifetime in seconds in the token response (e.g. `expires_in`). Unset: the token is cached until the upstream answers 401.'),
    /** Seconds before expiry at which the cached token counts as missing. Defaults to 30. Used only with `expiresIn`. */
    expiryMargin: z.number().nonnegative().optional()
        .describe('Seconds before expiry at which a new token is fetched. Default 30. Used only with `expiresIn`.'),
    transport: TransportSchema
        .describe('Where the extracted credentials go.')
});

// ─── JWT Self-Signed ──────────────────────────────────────────────────────────

const JWT_DEFAULT_TRANSPORT = {
    headers: [{ name: 'Authorization', credential: 'value', prefix: 'Bearer ' }]
};

export const JwtKeySchema = z.discriminatedUnion('source', [
    z.object({
        source: z.literal('file').describe('Key read from a file when a token is signed.'),
        path: z.string().describe('Path of the key file.')
    }),
    z.object({
        source: z.literal('value').describe('Key carried in the configuration itself.'),
        value: z.string().describe('The key: an HMAC secret for HS256, otherwise a PEM-encoded PKCS#8 private key.')
    })
]).describe('Signing key.');

export const JwtClaimsSchema = z.object({
    iss: z.string().optional().describe('`iss` claim. Omitted from the token when unset.'),
    sub: z.string().optional().describe('`sub` claim. Omitted from the token when unset.'),
    aud: z.union([z.string(), z.array(z.string())]).optional().describe('`aud` claim, one audience or a list. Omitted from the token when unset.'),
    exp: z.number().int().positive().default(3600).describe('Token lifetime in seconds. `iat` is always set.'),
    additionalClaims: z.record(z.string(), z.unknown()).optional().describe('Further claims added to the payload as given.')
});

export const JwtSelfSignedAuthSchema = z.object({
    strategy: z.literal(AuthStrategy.JwtSelfSigned)
        .describe('Sign a JWT locally and send it. The token is reused until shortly before it expires.'),
    key: JwtKeySchema,
    algorithm: z.enum(['RS256', 'ES256', 'HS256']).default('RS256').describe('Signing algorithm.'),
    claims: JwtClaimsSchema.default({ exp: 3600 }).describe('Claims of the signed token.'),
    transport: TransportSchema.default(JWT_DEFAULT_TRANSPORT)
        .describe('Where the token goes. The credential is named `value`. Default: `Authorization: Bearer <token>`.')
});

// ─── No Auth ──────────────────────────────────────────────────────────────────

export const NoAuthSchema = z.object({
    strategy: z.literal(AuthStrategy.None).optional()
        .describe('No credential is produced. Fixed headers or query parameters may still be sent through `transport`.')
});

// ─── Auth Config (discriminated union + static transport fallback) ────────────

export const AuthConfigSchema = z.union([
    KubernetesServiceAccountAuthSchema,
    TokenExchangeAuthSchema,
    JwtSelfSignedAuthSchema,
    NoAuthSchema.extend({
        transport: StaticTransportSchema.optional().describe('Fixed headers and query parameters, e.g. an API key.')
    })
]).describe('How requests to this API are authenticated. Pick the variant with `strategy`; without `strategy` no credential is produced.');

export type KubernetesServiceAccountAuth = z.infer<typeof KubernetesServiceAccountAuthSchema>;
export type TokenExtractorEntry = z.infer<typeof TokenExtractorEntrySchema>;
export type TokenExchangeRequest = z.infer<typeof TokenExchangeRequestSchema>;
export type TokenExchangeAuth = z.infer<typeof TokenExchangeAuthSchema>;
export type JwtKey = z.infer<typeof JwtKeySchema>;
export type JwtClaims = z.infer<typeof JwtClaimsSchema>;
export type JwtSelfSignedAuth = z.infer<typeof JwtSelfSignedAuthSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
