import { CommonUtils } from '@radoslavirha/utils';
import z from 'zod';
import { McpServerAuthConfigSchema } from './McpServerAuthConfig.js';

/** One MCP endpoint: where it is mounted, the knowledge base it serves, who may call it, and what it tells clients about itself. */
export const McpServerConfigSchema = z.object({
    path: z.string().startsWith('/').describe('Mount path of the endpoint in the app, e.g. `/development`. The public URL adds the route prefix (`/kb`), which Traefik strips before the request arrives.'),
    kb: z.string().min(1).describe('The knowledge base this endpoint serves: its id in knowledge-base-api, e.g. `development`. The endpoint is its knowledge base; a caller never chooses one.'),
    name: z.string().min(1).describe('Machine name clients see in `serverInfo.name`.'),
    title: z.string().min(1).describe('Human-readable name clients show.'),
    description: z.string().min(1).optional().describe('What the server is for. Defaults to the package description.'),
    auth: McpServerAuthConfigSchema.describe('Who may call the endpoint. Required: there is no anonymous endpoint.')
});

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

/**
 * One required entry per key, like `createExternalApisSchema`: a server the code mounts but the
 * config forgot fails the boot, naming it. Two servers on one path would shadow each other, so
 * paths must differ, ignoring case (Express routes `/Dev` and `/dev` alike).
 */
export const createMcpServersSchema = <K extends string>(keys: readonly K[]) =>
    z.object(Object.fromEntries(keys.map((key) => [key, McpServerConfigSchema])) as Record<K, typeof McpServerConfigSchema>)
        .superRefine((servers, ctx) => {
            const seen = new Map<string, string>();

            for (const [key, server] of Object.entries(servers as Record<string, McpServerConfig>)) {
                const other = seen.get(server.path.toLowerCase());

                if (CommonUtils.notUndefined(other)) {
                    ctx.addIssue({ code: 'custom', path: [key, 'path'], message: `Path ${server.path} is already used by ${other}.` });
                }
                seen.set(server.path.toLowerCase(), key);
            }
        });
