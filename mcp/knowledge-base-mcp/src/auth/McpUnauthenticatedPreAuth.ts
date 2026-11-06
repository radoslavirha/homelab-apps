import type { AuthInfo } from '@modelcontextprotocol/server';
import { Authenticator, credentialSourceOf, VerifierType } from '@radoslavirha/auth';
import { ObjectUtils, StringUtils } from '@radoslavirha/utils';
import { logger } from '@tsed/di';
import type { PlatformContext } from '@tsed/platform-http';
import type { McpServerUnauthenticatedConfig } from '../models/config/McpServerAuthConfig.js';

/**
 * Admits every request to one `unauthenticated` endpoint, as platform-mcp's `auth.preAuth`.
 *
 * With no `issuer` beside it, platform-mcp serves no Protected Resource Metadata and sends no
 * `401` challenge: this check is the whole of the endpoint's auth. It still goes through
 * `@radoslavirha/auth`'s `Authenticator`, with the `unauthenticated` verifier, so the principal
 * is built exactly as the APIs build it — every role the entry's `roles` lists, the subject from
 * `subjectHeader` when the request carries a usable one, else `defaultSubject`. platform-mcp parks
 * the result on `req.auth`, where `McpEndpointService` reads it for `@RequireRole` and
 * `On-Behalf-Of`, as it does for a verified token.
 */
export class McpUnauthenticatedPreAuth {
    readonly #authenticator: Authenticator;

    public constructor(
        private readonly method: string,
        auth: McpServerUnauthenticatedConfig
    ) {
        this.#authenticator = new Authenticator({
            [method]: {
                type: VerifierType.Unauthenticated,
                roles: ObjectUtils.values(auth.roles).filter(StringUtils.isNotEmpty),
                defaultSubject: auth.defaultSubject,
                subjectHeader: auth.subjectHeader,
                subjectKind: auth.subjectKind
            }
        });

        logger().warn({
            event: 'MCP_AUTH_UNAUTHENTICATED',
            endpoint: method,
            message: `MCP endpoint ${method} is unauthenticated: anyone who can reach it is ${auth.defaultSubject}, with every configured role.`
        });
    }

    public async preAuth($ctx: PlatformContext): Promise<AuthInfo> {
        const headers = Object.fromEntries(Object.entries($ctx.request.headers).map(([name, value]) => [name, StringUtils.isString(value) ? value : undefined]));
        const decision = await this.#authenticator.authenticate(credentialSourceOf(headers), [this.method]);

        // The unauthenticated verifier never refuses; a refusal here is a bug, not a caller to turn away.
        if (!decision.allowed) {
            throw new Error(`MCP endpoint ${this.method}: the unauthenticated verifier refused a request (${decision.reason}).`);
        }

        // No token, client or scopes: nobody signed in. The SDK only needs the fields present.
        return { token: '', clientId: '', scopes: [], extra: { principal: decision.principal } };
    }
}
