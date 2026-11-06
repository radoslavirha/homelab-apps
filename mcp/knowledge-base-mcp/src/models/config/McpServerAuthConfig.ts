import { KeySchema, UnauthenticatedVerifierSchema } from '@radoslavirha/auth';
import { CommonUtils, ObjectUtils } from '@radoslavirha/utils';
import z from 'zod';
import { McpAuthType } from './McpAuthType.enum.js';
import { KnowledgeBaseRole } from './KnowledgeBaseRole.enum.js';

/**
 * What a client asks Authentik for. `profile` is load-bearing: without it Authentik issues `aud`
 * as the bare client id, and the audience check refuses every token. `roles` carries the role.
 */
export const DEFAULT_SCOPES = ['openid', 'profile', 'email', 'roles'];

const REQUIRED_SCOPES = ['profile', 'roles'];

/** One Authentik role per `KnowledgeBaseRole`, every level required: a tool may ask for any of them. */
const RolesSchema = z.object(
    Object.fromEntries(Object.values(KnowledgeBaseRole).map((level) => [level, z.string().min(1)])) as Record<KnowledgeBaseRole, z.ZodString>
);

/**
 * The roles an `unauthenticated` endpoint grants, by level: at least one. A level left out is a
 * level nobody on the endpoint has — leave out `EDITOR` for a read-only endpoint.
 */
const GrantedRolesSchema = RolesSchema.partial()
    .refine((roles) => ObjectUtils.values(roles).some(CommonUtils.notUndefined), 'Grant at least one level: an endpoint that grants none refuses every tool.');

/**
 * The roles an `unauthenticated` endpoint grants when its config names none: every level, under
 * fixed placeholder names. Nothing checks them against an IdP; they only have to differ per level.
 */
export const DEFAULT_UNAUTHENTICATED_ROLES: Record<KnowledgeBaseRole, string> = {
    [KnowledgeBaseRole.Reader]: 'knowledge-base-mcp.reader',
    [KnowledgeBaseRole.Editor]: 'knowledge-base-mcp.editor'
};

/**
 * An OAuth resource server (the MCP authorization spec), with Authentik as the authorization
 * server. `type` may be left out: a config written before there was a choice is this type.
 */
export const McpServerOAuthConfigSchema = z.object({
    type: z.literal(McpAuthType.OAuth).default(McpAuthType.OAuth).describe('`oauth`, the default.'),
    issuer: z.url().describe('The authorization server clients log in at: the shared client registration\'s Authentik issuer, e.g. `https://auth.irha.cz/application/o/knowledge-base-mcp-clients/`. Advertised in the Protected Resource Metadata, and the only `iss` a token may carry — compared exactly, trailing slash included.'),
    audience: z.string().min(1).describe('The `aud` a token must carry: the endpoint\'s Authentik application for this environment, e.g. `knowledge-base-mcp-development-server1-production`.'),
    key: KeySchema.describe('Where the signing keys come from: the issuer\'s JWKS (`source: jwks`), or an inline key in tests.'),
    roles: RolesSchema.describe('The endpoint\'s Authentik role for each level, e.g. `{ READER: knowledge-base-mcp-development.reader, EDITOR: knowledge-base-mcp-development.editor }`. A token holding none of them is refused with 403; each tool then requires its own level.'),
    scopes: z.array(z.string().min(1)).default(DEFAULT_SCOPES)
        .refine((scopes) => REQUIRED_SCOPES.every((scope) => scopes.includes(scope)), {
            message: `must include ${REQUIRED_SCOPES.join(' and ')}: without profile the token's aud is the bare client id, without roles it carries no role`
        })
        .describe('Scopes advertised in the metadata and in the 401 challenge, which is what a client asks Authentik for.')
});

/**
 * No sign-in: every request is one configured principal holding every role `roles` lists, through
 * `@radoslavirha/auth`'s `unauthenticated` verifier — its subject fields and pattern are reused
 * from there. For trusted networks only: anyone who can reach the endpoint is that principal.
 */
export const McpServerUnauthenticatedConfigSchema = UnauthenticatedVerifierSchema
    .pick({ defaultSubject: true, subjectHeader: true, subjectKind: true })
    .extend({
        type: z.literal(McpAuthType.Unauthenticated).describe('`unauthenticated`: no sign-in. Trusted networks only.'),
        roles: GrantedRolesSchema.default(DEFAULT_UNAUTHENTICATED_ROLES).describe('The role each level maps to, as with `oauth`; every request holds all of them, so tools keep their per-level checks. Optional: absent grants every level. Leave out `EDITOR` for a read-only endpoint.')
    });

/**
 * How one endpoint admits its callers, chosen by `type`. Required on every endpoint: there is no
 * default that admits everyone, and `unauthenticated` is only ever an explicit choice.
 */
export const McpServerAuthConfigSchema = z.discriminatedUnion('type', [McpServerOAuthConfigSchema, McpServerUnauthenticatedConfigSchema]);

export type McpServerOAuthConfig = z.infer<typeof McpServerOAuthConfigSchema>;
export type McpServerUnauthenticatedConfig = z.infer<typeof McpServerUnauthenticatedConfigSchema>;
export type McpServerAuthConfig = z.infer<typeof McpServerAuthConfigSchema>;
