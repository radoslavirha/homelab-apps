import z from 'zod';

/** A secret, inline or — what a deployment uses — read from a mounted file. */
export const GitHubSecretSchema = z.discriminatedUnion('source', [
    z.object({
        source: z.literal('value'),
        value: z.string().min(1)
    }),
    z.object({
        source: z.literal('file'),
        path: z.string().min(1)
    })
]);

/** How the git source talks to GitHub, whatever it authenticates as. */
export const GitHubClientOptionsSchema = z.object({
    baseUrl: z.url().default('https://api.github.com'),
    timeoutMs: z.number().int().positive().default(15_000)
        .describe('Per attempt: each retry gets its own. A rate-limit wait between attempts is not counted.'),
    retries: z.number().int().nonnegative().max(10).default(3)
        .describe('Octokit retries server errors with backoff; rate limits are waited out separately.')
});

/**
 * A GitHub App the git source reads repositories as: the root `github`, or a knowledge base's own
 * `git.github`. `type: app` is the default, so a configuration written before tokens existed
 * still parses.
 *
 * **No repository name here.** An App may cover several repositories; a knowledge base says which
 * one it reads in its own `git.repository`, or the App must cover exactly one. Neither this repo
 * nor the deployment values (both public) name a private repository: the deployment reads
 * `git.repository` from a secret.
 */
export const GitHubAppConfigSchema = GitHubClientOptionsSchema.extend({
    type: z.literal('app'),
    clientId: z.string().min(1).describe('The App\'s client ID — the JWT issuer GitHub expects.'),
    privateKey: GitHubSecretSchema.describe('PEM as GitHub issues it (PKCS#1); PKCS#8 works too.')
});

export type GitHubSecret = z.infer<typeof GitHubSecretSchema>;
export type GitHubAppConfig = z.infer<typeof GitHubAppConfigSchema>;
