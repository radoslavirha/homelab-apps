import { KeySchema } from '@radoslavirha/auth';
import z from 'zod';
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
 * How one endpoint checks its callers: an OAuth resource server (the MCP authorization spec),
 * with Authentik as the authorization server. Required on every endpoint, with no way to switch
 * it off.
 */
export const McpServerAuthConfigSchema = z.object({
    issuer: z.url().describe('The authorization server clients log in at: the shared client registration\'s Authentik issuer, e.g. `https://auth.irha.cz/application/o/knowledge-base-clients/`. Advertised in the Protected Resource Metadata, and the only `iss` a token may carry — compared exactly, trailing slash included.'),
    audience: z.string().min(1).describe('The `aud` a token must carry: the endpoint\'s Authentik application for this environment, e.g. `kb-development-server1-production`.'),
    key: KeySchema.describe('Where the signing keys come from: the issuer\'s JWKS (`source: jwks`), or an inline key in tests.'),
    roles: RolesSchema.describe('The endpoint\'s Authentik role for each level, e.g. `{ READER: kb-development.reader, EDITOR: kb-development.editor }`. A token holding none of them is refused with 403; each tool then requires its own level.'),
    scopes: z.array(z.string().min(1)).default(DEFAULT_SCOPES)
        .refine((scopes) => REQUIRED_SCOPES.every((scope) => scopes.includes(scope)), {
            message: `must include ${REQUIRED_SCOPES.join(' and ')}: without profile the token's aud is the bare client id, without roles it carries no role`
        })
        .describe('Scopes advertised in the metadata and in the 401 challenge, which is what a client asks Authentik for.')
});

export type McpServerAuthConfig = z.infer<typeof McpServerAuthConfigSchema>;
