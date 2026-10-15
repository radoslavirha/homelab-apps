/**
 * Trust domains this service accepts callers from. Each value must have a
 * matching entry under `auth` in the configuration.
 *
 * One value: every caller — a person with a test token today, the MCP adapter and
 * Open WebUI's filter later — is a bearer JWT from the identity provider. A new
 * caller is another row in `auth.IDP.trustedIssuers`, not a new trust domain. What
 * a caller may do is `roles` on the `Principal`, checked with `@RequireRoles`;
 * which knowledge bases it may read is the `readers` list of each KB.
 */
export enum AuthMethod {
    /** Anyone the identity provider vouches for — a person or another service. */
    Idp = 'IDP'
}
