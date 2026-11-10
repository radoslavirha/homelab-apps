import z from 'zod';
import { GitHubClientOptionsSchema, GitHubSecretSchema } from './GitHubAppConfig.js';

/**
 * A token the git source reads and writes one repository with — a fine-grained personal access
 * token, for an organisation where a GitHub App cannot be installed. Commits are authored by the
 * token's owner; the `On-behalf-of` trailer still names the caller.
 *
 * A token has no installations to list, so a knowledge base using one must name its repository
 * in `git.repository` (the config schema refuses it otherwise). The token is read when the
 * repository is discovered, and again on every rediscovery after a failed run: a rotated token in
 * the mounted file is picked up without a restart.
 */
export const GitHubTokenConfigSchema = GitHubClientOptionsSchema.extend({
    type: z.literal('token').describe('`token`: authenticate with a token, e.g. a fine-grained personal access token. A knowledge base using one must set `git.repository`.'),
    token: GitHubSecretSchema.describe('Needs Contents: read and write, and Metadata: read, on the repository.')
});

export type GitHubTokenConfig = z.infer<typeof GitHubTokenConfigSchema>;
