/**
 * How an `AuthMethod` entry's credentials are actually verified.
 *
 * The `type` field of a verifier's configuration, and the discriminant of
 * `VerifierSchema`. A new mechanism is a new member plus a new `ITokenVerifier` —
 * not a change to any controller, because controllers name an `AuthMethod` and
 * never a type.
 *
 * The mirror of `AuthStrategy` in `http-provider`, which does the same job for
 * outbound calls.
 */
export enum VerifierType {
    /**
     * An RFC 7519 JWT presented as an RFC 6750 bearer token, verified against
     * the entry's trusted issuers.
     *
     * The transport is in the name because it is a real distinction and not a
     * hypothetical one: `AuthGuard` reads the `Authorization` header, and this
     * repository already has a route that cannot use it — the QR image is loaded
     * by an `<img src>`, which sends no headers. A JWT arriving somewhere else in
     * the request is a different extraction and therefore a different type, not
     * a wider version of this one.
     *
     * Says nothing about where keys come from: an inline HS256 secret and a
     * remote JWKS are both this type, chosen per issuer by `key.source`.
     */
    BearerJwt = 'bearer-jwt',
    /**
     * No credential at all: every request is admitted as one configured
     * principal, holding every configured role.
     *
     * Mostly for testing — running a service without an IdP to verify against.
     * Anyone who can reach the service is that principal, with all its roles.
     *
     * Named, never implied. It is never a default, a missing key or a flag: an
     * entry is this type only because its config says `"type": "unauthenticated"`,
     * a forgotten `auth` entry still fails at boot, and `describeAuthConfig`
     * raises the boot log to `warn` for as long as one is configured.
     */
    Unauthenticated = 'unauthenticated'
}
