import { VerifierType } from '@radoslavirha/auth';

/**
 * How one MCP endpoint admits its callers: the `type` of `mcpServers.<key>.auth`.
 *
 * Values are lowercase, against the repository's enum rule, because they are config values
 * shared with `@radoslavirha/auth`'s `VerifierType` (`unauthenticated` is the same word in the
 * API's `auth` block and here).
 */
export enum McpAuthType {
    /** An OAuth resource server with Authentik as the authorization server. The default when `type` is absent. */
    OAuth = 'oauth',
    /** No sign-in: every request is one configured principal with every configured role. Trusted networks only. */
    Unauthenticated = VerifierType.Unauthenticated
}
