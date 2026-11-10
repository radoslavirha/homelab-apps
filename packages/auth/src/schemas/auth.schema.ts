import { z } from 'zod';
import { VerifierType } from '../VerifierType.js';

/**
 * An inline key, carried in the configuration itself.
 *
 * This is what lets `config/localhost.json` be a real *issuer row* rather than a
 * bypass flag: local development verifies against an HS256 secret, so the code
 * exercised locally is the code that runs in production and the 401 path stops
 * being the only one never covered. The outbound half already exists —
 * `JwtSelfSignedStrategy` in `http-provider` signs with the same
 * `{ source: 'value' }` shape — so the two halves meet in a real signed round
 * trip on a laptop.
 *
 * It fails closed in a way a disable flag does not: a leftover dev issuer row is
 * exploitable only by someone who also holds the dev secret, where a leftover
 * disable flag *is* the whole vulnerability.
 */
export const StaticKeySchema = z.object({
    source: z.literal('value').describe('Inline key, carried in the configuration itself.'),
    /**
     * Algorithm this key is for, and the only one accepted from this issuer.
     *
     * Singular and required, because it is also the allowlist. Trusting the
     * algorithm named in the JWS header is the classic JWT failure — `alg:
     * none`, or an RSA public key accepted as an HMAC secret.
     */
    algorithm: z.string().min(1).default('HS256')
        .describe('Algorithm this key is for, and the only one accepted from this issuer. The `alg` in the token header is never trusted on its own.'),
    /** `HS*`: the shared secret. Otherwise: a PEM-encoded public key. */
    value: z.string().min(1)
        .describe('For `HS*`: the shared secret. Otherwise: a PEM-encoded public key.')
});

/** Keys fetched from a remote JWKS endpoint. */
export const JwksKeySchema = z.object({
    source: z.literal('jwks').describe('Keys fetched from a remote JWKS endpoint.'),
    uri: z.url().describe('URL of the JWKS endpoint.'),
    /**
     * Whether the JWKS fetch itself needs a credential.
     *
     * This single field is the whole of the Kubernetes special case: the
     * apiserver's JWKS is not anonymously readable, the IdP's is. Configuration,
     * not a branch in the verifier — which is what lets the same binary run
     * outside a cluster.
     */
    auth: z.enum(['none', 'serviceAccountToken']).default('none')
        .describe('Credential for the JWKS fetch itself. `serviceAccountToken` sends the pod\'s Kubernetes service account token, for the apiserver JWKS, which is not anonymously readable.'),
    /** Signature algorithms accepted from this issuer. An allowlist, always. */
    algorithms: z.array(z.string().min(1)).default(['RS256'])
        .describe('Signature algorithms accepted from this issuer (an allowlist).'),
    /** How long a fetched key set is reused, so the IdP is not on every request's path. */
    cacheTtlSeconds: z.number().int().positive().default(300)
        .describe('How long a fetched key set is reused, in seconds.'),
    /**
     * Floor on how often a key set may be refetched, independent of the cache
     * age above.
     *
     * The cache says when a key set is stale; this says how fast a *miss* may
     * force a refetch. Without it, a stream of tokens carrying an unknown `kid`
     * becomes a fetch per request — a bad token turned into a denial of service
     * against the IdP.
     */
    refreshCooldownMs: z.number().int().positive().default(30_000)
        .describe('Minimum time between two key set fetches, in ms, so tokens with an unknown `kid` cannot force a fetch per request.'),
    /**
     * Hard ceiling on the fetch. Required, because the failure mode is the
     * point: a JWKS endpoint that never answers turns every request into a hang
     * rather than a refusal, exhausting the connection pool and taking down
     * routes that need no authentication at all.
     */
    timeoutMs: z.number().int().positive().default(3000)
        .describe('Time limit for one JWKS fetch, in ms.')
});

export const KeySchema = z.discriminatedUnion('source', [StaticKeySchema, JwksKeySchema])
    .describe('Key that verifies token signatures from this issuer.');

/**
 * One trust source: an issuer we are willing to believe, and the terms.
 *
 * Kubernetes is a row here, not a code path. Add a cluster, swap IdPs, or run
 * with no Kubernetes at all — each is a configuration change.
 */
export const TrustedIssuerSchema = z.object({
    /**
     * Operator-facing label. Not matched against anything — it exists so the
     * boot-time log can name each trusted issuer, which is the answer to "why
     * is my token rejected" nine times in ten.
     */
    name: z.string().min(1)
        .describe('Label for this issuer in the boot log. Not matched against anything.'),
    /**
     * Exact `iss` value to match, compared as a string.
     *
     * Never normalised, and in particular the trailing slash is never stripped:
     * Authentik's per-provider issuers carry one and `iss` comparison is exact.
     * A helpful normalisation here would silently accept a token from a
     * different issuer.
     */
    issuer: z.string().min(1)
        .describe('Exact `iss` value to match, compared as a string. Never normalised: a trailing slash matters.'),
    /**
     * Audience this service answers to. A token minted for another service must
     * be refused even though its signature is perfectly valid — that refusal is
     * the only thing standing between "a token" and "a token for us".
     */
    audience: z.string().min(1)
        .describe('Audience (`aud`) this service answers to. Tokens minted for another audience are refused.'),
    key: KeySchema,
    /**
     * Which caller class tokens from this issuer represent. Stamped onto the
     * `Principal`; a property of the trust source, not of the token.
     */
    subjectKind: z.enum(['human', 'service', 'device']).default('human')
        .describe('Caller class that tokens from this issuer represent, stamped onto the principal.'),
    /**
     * Claim to read roles from. Authentik puts them in `roles`; the Kubernetes
     * apiserver has no equivalent, so a source with no such claim yields an
     * empty list rather than an error.
     */
    rolesClaim: z.string().default('roles')
        .describe('Token claim the roles are read from. A token without it has no roles.')
});

/**
 * Settings for a `bearer-jwt` verifier.
 *
 * The `type` discriminates it from the other verifier kinds an entry could hold;
 * the entry's *name* is the key it is filed under in the `auth` block, and is
 * chosen by the service. Two entries may share this type — one
 * trusting the IdP, another trusting a cluster — and a route admits one by name
 * without admitting the other.
 */
export const JwtVerifierSchema = z.object({
    type: z.literal(VerifierType.BearerJwt).describe('Verify a bearer JWT from the `Authorization` header.'),
    /**
     * Trust sources, in no particular order — a token is matched to one by its
     * `iss`, never by position.
     *
     * At least one, because an entry that trusts nobody rejects every request.
     * Refusing the config is one loud startup error; accepting it is a service
     * that is up, healthy, and turning away all traffic — which reads as a
     * network fault and gets debugged for an hour.
     */
    trustedIssuers: z.array(TrustedIssuerSchema)
        .min(1, 'a bearer-jwt verifier needs at least one trusted issuer; with none it could never verify anything')
        .superRefine((issuers, ctx) => {
            // A verifier looks sources up by `iss`; a repeated issuer would let the later row
            // silently replace the earlier one, quietly changing who is trusted.
            const seen = new Set<string>();
            issuers.forEach((trusted, index) => {
                if (seen.has(trusted.issuer)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [index, 'issuer'],
                        message: `duplicate trusted issuer '${trusted.issuer}'; each issuer may appear once per entry`
                    });
                }
                seen.add(trusted.issuer);
            });
        })
        .describe('Issuers whose tokens are accepted. At least one; each `issuer` at most once. A token is matched to a row by its `iss`.')
});

/**
 * What an `unauthenticated` entry's subject must look like — the configured
 * default and any value read from `subjectHeader` alike.
 *
 * Downstream the subject becomes an `On-Behalf-Of` header and a commit trailer,
 * so it is a short single-line token: no whitespace, no newline.
 */
export const UNAUTHENTICATED_SUBJECT_PATTERN = /^[\w.@+-]{1,150}$/;

/**
 * Settings for an `unauthenticated` verifier: no credential is checked, and every
 * request is admitted as one principal holding all of `roles`.
 *
 * Chosen per entry, deliberately — mostly for testing without an IdP. Nothing grants
 * it implicitly: it exists only where a config names `"type": "unauthenticated"`.
 */
export const UnauthenticatedVerifierSchema = z.object({
    type: z.literal(VerifierType.Unauthenticated)
        .describe('No credential is checked: every request is admitted as one principal holding all of `roles`. Meant for testing without an IdP; the boot log warns about it.'),
    /**
     * Every role every request gets. At least one, because an entry that grants
     * nothing would admit callers to a route only to answer `403` on every
     * `@RequireRoles` — a config mistake better caught at boot.
     */
    roles: z.array(z.string().min(1))
        .min(1, 'an unauthenticated verifier needs at least one role; every request is given all of them')
        .describe('Roles every request is given. At least one.'),
    /** The principal's `subject` when no usable `subjectHeader` value arrives. */
    defaultSubject: z.string().regex(UNAUTHENTICATED_SUBJECT_PATTERN)
        .describe('Subject of the principal when no usable `subjectHeader` value arrives.'),
    /**
     * Header whose value, when present and matching
     * `UNAUTHENTICATED_SUBJECT_PATTERN`, becomes the subject instead of
     * `defaultSubject` (e.g. `X-User`). Absent or malformed falls back to the
     * default; it never refuses a request.
     *
     * **Unverified.** Any caller can put any name in it. It is a label for logs
     * and commit attribution, never an identity and never a basis for access.
     */
    subjectHeader: z.string().min(1).optional()
        .describe('Header whose value, when present and matching the subject pattern, becomes the subject (e.g. `X-User`). Unverified: a label for logs and attribution, never a basis for access.'),
    /** Which caller class the principal is. Stamped onto the `Principal`. */
    subjectKind: z.enum(['human', 'service', 'device']).default('human')
        .describe('Caller class of the principal.')
});

/**
 * One entry of the `auth` block: whichever verifier kind it declares.
 *
 * A discriminated union on `type`, so a second mechanism — an API key, an HMAC
 * signature — is a new member here plus a new `ITokenVerifier`, and no change to
 * any controller. Controllers name an `AuthMethod`; they never name a type.
 *
 * **The one permissive member, `unauthenticated`, is explicit and named.** What
 * this schema makes unrepresentable is the *accidental* open state: an on/off
 * switch, a missing key, a default that admits everyone. None of those exist —
 * a forgotten entry still fails at boot. `unauthenticated` is a deliberate
 * per-entry choice, mostly for testing without an IdP; it names the principal
 * and roles it grants, and the boot log warns about it.
 */
export const VerifierSchema = z.discriminatedUnion('type', [JwtVerifierSchema, UnauthenticatedVerifierSchema])
    .describe('How callers of the routes guarded by this method are verified.');

/**
 * The `auth` block of a service's configuration: named entries, each declaring
 * how its callers are verified.
 *
 * ```jsonc
 * "auth": {
 *     "IDP": { "type": "bearer-jwt", "trustedIssuers": [ … ] }
 * }
 * ```
 *
 * **The names are the service's, not this package's.** They describe which
 * callers a deployment admits — its people, its cluster, its devices — which is
 * knowledge no shared package has. Each service declares its own enum and passes
 * it to {@link createAuthConfigSchema}, exactly as it declares `ExternalApi` and
 * passes it to `createExternalApisSchema` on the outbound side.
 *
 * This open form is the runtime's view: `Authenticator` builds whatever it finds
 * and knows nothing about which routes exist. Services should configure with
 * {@link createAuthConfigSchema} instead, which is the form that can check
 * anything.
 *
 * The block is *only* that map. There is no wrapper key and nothing beside it —
 * no on/off switch, no route list. Every field ever proposed for this level
 * turned out to be either a state where a forgotten config key leaves a service
 * unauthenticated, or a copy of something the source already says. A route is
 * guarded by `@Authenticate()` or opened by `@Anonymous()`, and both are visible
 * next to the route rather than in a file that can drift from it. (An entry of
 * type `unauthenticated` still guards: its route keeps its `@Authenticate` and
 * role checks; only *who* is admitted is decided by the deployment.)
 */
export const AuthConfigSchema = z.record(z.string(), VerifierSchema);

/**
 * The `auth` block tied to the methods a service's routes actually ask for.
 *
 * The counterpart of `createExternalApisSchema`, and for the same reason: a
 * service names what its own code depends on, and Zod then refuses a
 * configuration that is missing it — at boot, naming the path.
 *
 * ```ts
 * // apis/<api>/src/models/config/AuthMethod.enum.ts
 * export enum AuthMethod { Idp = 'IDP' }
 *
 * // apis/<api>/src/models/config/ConfigModel.ts
 * auth: createAuthConfigSchema(Object.values(AuthMethod))
 * ```
 *
 * Each named method becomes a **required** key, so a deployment that forgets one
 * fails at boot with `auth.IDP` in the error rather than at the first request to
 * a route decorated `@Authenticate(AuthMethod.Idp)`. A map is what makes that
 * possible at all: a key can be required, where an array element can only be
 * counted after the fact.
 *
 * Strict, so a `USRE` typo is a rejected key rather than a silently stripped one
 * — Zod's default would leave the service with no verifier, booting healthy and
 * answering 500 on its first guarded request.
 */
export function createAuthConfigSchema<M extends string>(
    methods: readonly M[]
): z.ZodObject<Record<M, typeof VerifierSchema>, z.core.$strict> {
    const shape = Object.fromEntries(
        methods.map(method => [method, VerifierSchema])
    ) as Record<M, typeof VerifierSchema>;

    return z.strictObject(shape);
}

/** Config as **authored** — every defaulted field may be omitted. */
export type AuthConfigInput = z.input<typeof AuthConfigSchema>;

/** Config as **parsed** — every default resolved. What the runtime works with. */
export type AuthConfig = z.output<typeof AuthConfigSchema>;

export type StaticKey = z.output<typeof StaticKeySchema>;
export type JwksKey = z.output<typeof JwksKeySchema>;
export type KeyConfig = z.output<typeof KeySchema>;
export type TrustedIssuer = z.output<typeof TrustedIssuerSchema>;
export type JwtVerifierConfig = z.output<typeof JwtVerifierSchema>;
export type UnauthenticatedVerifierConfig = z.output<typeof UnauthenticatedVerifierSchema>;
export type VerifierConfig = z.output<typeof VerifierSchema>;
