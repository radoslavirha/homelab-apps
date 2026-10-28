import { OAuthError, OAuthErrorCode, type AuthInfo, type OAuthTokenVerifier } from '@modelcontextprotocol/server';
import { Authenticator, credentialSourceOf, VerificationReason, VerifierType } from '@radoslavirha/auth';
import { NumberUtils, ObjectUtils, StringUtils } from '@radoslavirha/utils';
import { logger } from '@tsed/di';
import type { McpServerAuthConfig } from '../models/config/McpServerAuthConfig.js';

/**
 * The claims the SDK needs beyond what a `Principal` carries, as Authentik writes them. Read only
 * once the signature has verified, and each still checked: a JSON payload can hold anything.
 */
interface AccessTokenClaims {
    readonly exp?: number;
    readonly azp?: string;
    readonly scope?: string;
}

const claimsOf = (token: string): AccessTokenClaims => {
    const [, payload] = token.split('.');

    return JSON.parse(Buffer.from(payload ?? '', 'base64url').toString('utf8')) as AccessTokenClaims;
};

/**
 * Checks a bearer token for one MCP endpoint, as platform-mcp's `auth.verifier`.
 *
 * `@radoslavirha/auth` decides — issuer, audience, signature, expiry, exactly as in the APIs — and
 * this maps its decision to what the MCP SDK answers with:
 *
 * - any refusal of the credential: `invalid_token`, a `401` whose challenge points at the
 *   Protected Resource Metadata. The reason stays in the log; the caller is told nothing more.
 * - `indeterminate` (the JWKS could not be fetched): `server_error`, a `500`. The token may be
 *   perfectly good, so it must not read as a bad one.
 * - a good token holding none of the endpoint's roles: `insufficient_scope`, a `403`. Signing in
 *   again cannot help, so it is never a `401`; the refusal names no role. Which role each tool
 *   needs is checked per tool (`@RequireRole`); this is the door.
 *
 * The caller's token stops here: tools call knowledge-base-api with this server's own token.
 */
export class McpTokenVerifier implements OAuthTokenVerifier {
    readonly #authenticator: Authenticator;

    public constructor(
        private readonly method: string,
        private readonly auth: McpServerAuthConfig
    ) {
        // One trusted issuer, the shared client registration. People sign in through it.
        this.#authenticator = new Authenticator({
            [method]: {
                type: VerifierType.BearerJwt,
                trustedIssuers: [{ name: method, issuer: auth.issuer, audience: auth.audience, key: auth.key, subjectKind: 'human', rolesClaim: 'roles' }]
            }
        });
    }

    public async verifyAccessToken(token: string): Promise<AuthInfo> {
        const decision = await this.#authenticator.authenticate(credentialSourceOf({ authorization: `Bearer ${token}` }), [this.method]);

        if (!decision.allowed) {
            logger().info({ event: 'MCP_AUTH_REFUSED', endpoint: this.method, reason: decision.reason, detail: decision.detail });

            if (decision.reason === VerificationReason.Indeterminate) {
                throw new OAuthError(OAuthErrorCode.ServerError, 'The access token could not be verified.');
            }

            throw new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid access token.');
        }

        const { principal } = decision;

        if (!ObjectUtils.values(this.auth.roles).some((role) => principal.roles.includes(role))) {
            logger().info({ event: 'MCP_AUTH_FORBIDDEN', endpoint: this.method, subject: principal.subject });

            throw new OAuthError(OAuthErrorCode.InsufficientScope, 'Insufficient permissions.');
        }

        const claims = claimsOf(token);

        return {
            token,
            clientId: StringUtils.isString(claims.azp) ? claims.azp : '',
            scopes: StringUtils.isString(claims.scope) ? claims.scope.split(' ').filter(Boolean) : [],
            // Without it the SDK refuses the token; jose has already refused an expired one.
            expiresAt: NumberUtils.isNumber(claims.exp) ? claims.exp : undefined,
            extra: { principal }
        };
    }
}
