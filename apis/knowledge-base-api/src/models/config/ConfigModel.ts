import { BaseConfig } from '@radoslavirha/tsed-configuration';
import { createExternalApisSchema } from '@radoslavirha/tsed-http-provider';
import { HealthConfigSchema } from '@radoslavirha/tsed-health';
import { LoggerOptionsSchema } from '@radoslavirha/tsed-logger';
import { OtelConfigSchema } from '@radoslavirha/otel';
import { CommonUtils } from '@radoslavirha/utils';
import z from 'zod';
// From `@radoslavirha/auth`, not the Ts.ED wrapper that re-exports it. The
// wrapper's barrel also carries `AuthenticationService`, whose `@Injectable()`
// runs on import — so importing a pure schema factory from there registers a DI
// provider that every unit test then has to satisfy.
import { createAuthConfigSchema } from '@radoslavirha/auth';
import { AuthMethod } from './AuthMethod.enum.js';
import { DatabaseConfigSchema } from './DatabaseConfig.js';
import { EmbeddingsConfigSchema } from './EmbeddingsConfig.js';
import { ExternalApi } from './ExternalApi.enum.js';
import { GitHubAppConfigSchema } from './GitHubAppConfig.js';
import { IndexerConfigSchema } from './IndexerConfig.js';
import { KnowledgeBaseConfigSchema } from './KnowledgeBaseConfig.js';
import { KnowledgeBaseSource } from './KnowledgeBaseSource.enum.js';
import { SearchConfigSchema } from './SearchConfig.js';

export const ConfigSchema = BaseConfig.extend({
    externalApis: createExternalApisSchema(Object.values(ExternalApi))
        .describe('External APIs this service calls — base URL, auth, resilience and logging per API.'),
    database: DatabaseConfigSchema.describe('The Postgres database this service owns: schema, index and search.'),
    github: GitHubAppConfigSchema.optional().describe('GitHub App credentials. Required when any knowledge base has source GIT.'),
    embeddings: EmbeddingsConfigSchema.describe('Embedding models served by Ollama.'),
    knowledgeBases: z.array(KnowledgeBaseConfigSchema).min(1).describe('Every knowledge base this service indexes and serves.'),
    indexer: IndexerConfigSchema.describe('The background indexing loop.'),
    search: SearchConfigSchema.describe('Hybrid search tuning.'),
    // Every field is defaulted, so omitting `health` entirely is valid — additive, and
    // safe for a rolling deploy where an old pod reads a new ConfigMap or vice versa.
    health: HealthConfigSchema.optional().describe('Health endpoint configuration.'),
    logger: LoggerOptionsSchema.optional(),
    otel: OtelConfigSchema.optional().describe('OpenTelemetry configuration.'),
    /**
     * Required, and tied to the methods this API's routes actually ask for: a config
     * without `auth.IDP` fails to parse at boot rather than answering 500 later.
     */
    auth: createAuthConfigSchema(Object.values(AuthMethod)).describe('Authentication configuration.')
}).superRefine((config, ctx) => {
    // Cross-field rules a per-field schema cannot express. Failing here stops the boot
    // with the offending path, rather than a KB that silently never embeds.
    const models = new Set(config.embeddings.models.map((model) => model.name));
    const ids = new Set<string>();

    if (models.size !== config.embeddings.models.length) {
        ctx.addIssue({ code: 'custom', path: ['embeddings', 'models'], message: 'Model names must be unique.' });
    }

    config.knowledgeBases.forEach((kb, index) => {
        if (ids.has(kb.id)) {
            ctx.addIssue({ code: 'custom', path: ['knowledgeBases', index, 'id'], message: `Duplicate knowledge base id "${kb.id}".` });
        }
        ids.add(kb.id);

        kb.models.forEach((model, modelIndex) => {
            if (!models.has(model)) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['knowledgeBases', index, 'models', modelIndex],
                    message: `Model "${model}" is not declared in embeddings.models.`
                });
            }
        });

        if (kb.source === KnowledgeBaseSource.Git && CommonUtils.isUndefined(config.github)) {
            ctx.addIssue({ code: 'custom', path: ['github'], message: `Knowledge base "${kb.id}" has source GIT, which needs github.` });
        }
    });
});
export type ConfigModel = z.infer<typeof ConfigSchema>;
