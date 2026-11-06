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
    instructions: z.string().min(1).optional().describe('The MCP server `instructions` clients hand their agent: how to use this knowledge base. Defaults to `DEFAULT_INSTRUCTIONS` — search first, call `conventions` before writing or preparing files, approve writes.'),
    auth: McpServerAuthConfigSchema.describe('Who may call the endpoint. Required: there is no anonymous endpoint.')
});

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

/** An endpoint's key in `mcpServers`: `UPPER_SNAKE_CASE`, e.g. `DEVELOPMENT_KB`. It names the endpoint in logs and refusals. */
export const MCP_SERVER_KEY = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;

/**
 * The MCP endpoints this app mounts, by key: as many as the config has, at least one. Nothing in
 * the code names a key — a tool finds its endpoint by the request path — so an endpoint is
 * config only. Two servers on one path would shadow each other, so paths must differ, ignoring
 * case (Express routes `/Dev` and `/dev` alike).
 */
export const McpServersSchema = z.record(
    z.string().regex(MCP_SERVER_KEY, 'A key is UPPER_SNAKE_CASE, e.g. DEVELOPMENT_KB.'),
    McpServerConfigSchema
)
    .refine((servers) => !CommonUtils.isEmpty(servers), 'At least one MCP server is required.')
    .superRefine((servers, ctx) => {
        const seen = new Map<string, string>();

        for (const [key, server] of Object.entries(servers)) {
            const other = seen.get(server.path.toLowerCase());

            if (CommonUtils.notUndefined(other)) {
                ctx.addIssue({ code: 'custom', path: [key, 'path'], message: `Path ${server.path} is already used by ${other}.` });
            }
            seen.set(server.path.toLowerCase(), key);
        }
    });

export type McpServersConfig = z.infer<typeof McpServersSchema>;
