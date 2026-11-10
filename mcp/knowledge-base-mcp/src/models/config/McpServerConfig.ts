import { CommonUtils } from '@radoslavirha/utils';
import z from 'zod';
import { McpSearchConfigSchema } from './McpSearchConfig.js';
import { McpServerAuthConfigSchema } from './McpServerAuthConfig.js';

/** One MCP endpoint: where it is mounted, the knowledge base it serves, who may call it, and what it tells clients about itself. */
export const McpServerConfigSchema = z.object({
    path: z.string().startsWith('/').describe('Mount path of the endpoint in the app, e.g. `/development`. The public URL adds the route prefix (`/kb`), which Traefik strips before the request arrives.'),
    kb: z.string().min(1).describe('The knowledge base this endpoint serves: its id in knowledge-base-api, e.g. `development`. The endpoint is its knowledge base; a caller never chooses one.'),
    name: z.string().min(1).describe('Machine name clients see in `serverInfo.name`. Also identifies the endpoint in logs, refusals and auth, so it is unique across `mcpServers`.'),
    title: z.string().min(1).describe('Human-readable name clients show.'),
    description: z.string().min(1).optional().describe('What the server is for. Defaults to the package description.'),
    instructions: z.string().min(1).optional().describe('The MCP server `instructions` clients hand their agent: how to use this knowledge base. Defaults to `DEFAULT_INSTRUCTIONS` — search first, call `conventions` before writing or preparing files, approve writes.'),
    auth: McpServerAuthConfigSchema.describe('Who may call the endpoint, by `type`: `oauth` (the default when `type` is absent) or `unauthenticated`. Required: an endpoint is never open by omission.'),
    search: McpSearchConfigSchema.optional().describe('How the endpoint searches: limits, embedding model and RRF weights. Absent: `DEFAULT_SEARCH_CONFIG`. A second endpoint on the same `kb` with other settings is how an alternative is tried side by side.')
});

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

/**
 * The MCP endpoints this app mounts, as a list: as many as the config has, at least one. Nothing
 * in the code names an endpoint — a tool finds its endpoint by the request path — so an endpoint is
 * config only. An endpoint is identified by its `name` in logs, refusals and auth, so names must
 * differ. Two servers on one path would shadow each other, so paths must differ too, ignoring
 * case (Express routes `/Dev` and `/dev` alike).
 */
export const McpServersSchema = z.array(McpServerConfigSchema)
    .min(1, 'At least one MCP server is required.')
    .superRefine((servers, ctx) => {
        const names = new Map<string, number>();
        const paths = new Map<string, string>();

        servers.forEach((server, index) => {
            const sameName = names.get(server.name);
            const samePath = paths.get(server.path.toLowerCase());

            if (CommonUtils.notUndefined(sameName)) {
                ctx.addIssue({ code: 'custom', path: [index, 'name'], message: `Name ${server.name} is already used by mcpServers[${sameName}].` });
            }
            if (CommonUtils.notUndefined(samePath)) {
                ctx.addIssue({ code: 'custom', path: [index, 'path'], message: `Path ${server.path} is already used by ${samePath}.` });
            }
            names.set(server.name, index);
            paths.set(server.path.toLowerCase(), server.name);
        });
    });

export type McpServersConfig = z.infer<typeof McpServersSchema>;
