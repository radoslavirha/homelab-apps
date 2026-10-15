import z from 'zod';

/**
 * The GitHub App the git source reads repositories as.
 *
 * **No repository name, deliberately.** The service asks the App's installations which
 * repository they cover, so neither this repo nor the deployment values (both public) name a
 * private repository.
 */
export const GitHubAppConfigSchema = z.object({
    clientId: z.string().min(1).describe('The App\'s client ID — the JWT issuer GitHub expects.'),
    privateKey: z.discriminatedUnion('source', [
        z.object({
            source: z.literal('value'),
            value: z.string().min(1).describe('PEM as GitHub issues it (PKCS#1); PKCS#8 works too.')
        }),
        z.object({
            source: z.literal('file'),
            path: z.string().min(1)
        })
    ]),
    baseUrl: z.url().default('https://api.github.com'),
    timeoutMs: z.number().int().positive().default(15_000).describe('Per request, retries excluded.'),
    retries: z.number().int().nonnegative().max(10).default(3)
        .describe('Octokit retries server errors with backoff; rate limits are waited out separately.')
});

export type GitHubAppConfig = z.infer<typeof GitHubAppConfigSchema>;
