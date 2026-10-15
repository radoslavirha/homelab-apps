import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConfigSchema } from './ConfigModel.js';

const base = (): Record<string, unknown> => ({
    ...JSON.parse(readFileSync(new URL('../../../config/test.json', import.meta.url), 'utf-8')),
    serviceName: 'knowledge-base-api',
    version: '0.1.0',
    description: 'test'
});

const issues = (config: Record<string, unknown>): string[] => {
    const result = ConfigSchema.safeParse(config);

    return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
};

describe('ConfigSchema', () => {
    it('accepts the test configuration and fills in the defaults', () => {
        const config = ConfigSchema.parse(base());

        expect(config.knowledgeBases[0]).toMatchObject({
            contentType: 'MARKDOWN',
            chunking: { maxChars: 3000, overlapChars: 0 },
            git: { include: ['raw/', 'work/', 'mirror/'], extensions: ['.md'] }
        });
        expect(config.database).toMatchObject({ sslMode: 'DISABLE', pool: { max: 5 } });
        expect(config.search).toMatchObject({ rrfK: 60, weights: { fullText: 0, vector: 1 }, fullTextMatch: 'ANY' });
        expect(config.embeddings.keepAlive).toBe('1m');
        expect(config.indexer.maxScheduledEmbeddings).toBe(300);
        expect(config.indexer).toMatchObject({ intervalMs: 300_000 });
    });

    it('fails at boot when a knowledge base names an undeclared model', () => {
        const config = base();

        (config.knowledgeBases as { models: string[] }[])[0].models = ['missing:1b'];

        expect(issues(config)).toContain('knowledgeBases.0.models.0: Model "missing:1b" is not declared in embeddings.models.');
    });

    it('fails at boot when a git knowledge base has no GitHub App', () => {
        const config = base();

        delete config.github;

        expect(issues(config)).toContain('github: Knowledge base "dev" has source GIT, which needs github.');
    });

    it('fails at boot on duplicate knowledge base ids', () => {
        const config = base();
        const [kb] = config.knowledgeBases as unknown[];

        config.knowledgeBases = [kb, kb];

        expect(issues(config)).toContain('knowledgeBases.1.id: Duplicate knowledge base id "dev".');
    });

    it('requires a CA file to verify the server', () => {
        const config = base();

        config.database = { ...(config.database as object), sslMode: 'VERIFY_FULL' };

        expect(issues(config)).toContain('database.caFile: database.caFile is required when sslMode is VERIFY_FULL');
    });

    it('requires the {text} placeholder in a document template', () => {
        const config = base();

        (config.embeddings as { models: { documentTemplate: string }[] }).models[0].documentTemplate = 'title: {title}';

        expect(issues(config).some((issue) => issue.startsWith('embeddings.models.0.documentTemplate'))).toBe(true);
    });
});
