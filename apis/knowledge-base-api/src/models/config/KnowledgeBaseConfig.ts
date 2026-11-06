import z from 'zod';
import { KNOWLEDGE_BASE_ID_PATTERN } from '../KnowledgeBaseId.js';
import { ContentType } from './ContentType.enum.js';
import { GitHubAppConfigSchema } from './GitHubAppConfig.js';
import { KnowledgeBaseSource } from './KnowledgeBaseSource.enum.js';

/** `owner/name`, in the characters GitHub allows in each. */
const GITHUB_REPOSITORY_PATTERN = /^[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/;

export const ChunkingConfigSchema = z.object({
    /**
     * A section longer than this is split at paragraph boundaries, the heading kept on every
     * part. 3000 is what the model measurement ran with: chunks p50 721, p95 2719, max 3226
     * characters on the development KB — inside embeddinggemma's 2k-token context.
     */
    maxChars: z.number().int().min(200).default(3000),
    /** Trailing paragraphs of one part repeated at the start of the next, up to this length. */
    overlapChars: z.number().int().nonnegative().default(0)
}).prefault({});

const KnowledgeBaseBaseSchema = z.object({
    id: z.string().regex(KNOWLEDGE_BASE_ID_PATTERN).describe('Stored in `documents.kb`; what callers pass as `kb`.'),
    contentType: z.enum(ContentType).default(ContentType.Markdown),
    tsConfig: z.string().regex(/^[a-z_]+$/).default('english')
        .describe('Postgres text search configuration for this KB\'s full-text index, e.g. `english`, `simple`.'),
    /**
     * Embedding models this KB is embedded with, by `embeddings.models[].name`. The **first**
     * answers questions; the others are built alongside for comparison. Empty means full-text
     * only.
     */
    models: z.array(z.string().min(1)).default([]),
    /** Authentik roles allowed to read this KB. A caller holding none of them never sees it. */
    readers: z.array(z.string().min(1)).min(1),
    /**
     * The file in the source that holds this KB's house rules — formats, frontmatter, areas,
     * naming — e.g. `README.md`. `GET /conventions` serves it, read from the source as it is now,
     * so it need not be under `git.include`. Unset: the KB publishes none.
     */
    conventionsPath: z.string().min(1).regex(/^[^/]/, 'A path inside the source, without a leading /.').optional(),
    chunking: ChunkingConfigSchema
});

export const GitSourceConfigSchema = z.object({
    branch: z.string().min(1).optional().describe('Branch to index. Defaults to the repository\'s default branch.'),
    include: z.array(z.string()).default(['raw/', 'work/', 'mirror/'])
        .describe('Path prefixes to index. The first path segment becomes `metadata.area`.'),
    extensions: z.array(z.string().startsWith('.')).default(['.md']),
    repository: z.string().regex(GITHUB_REPOSITORY_PATTERN).optional()
        .describe('`owner/name` of the repository to read, from those the App covers, compared case-insensitively. Required when the App covers several. Comes from a secret, never from values.'),
    github: GitHubAppConfigSchema.optional()
        .describe('The GitHub App of this knowledge base. Defaults to the root `github`.')
}).prefault({});

export const GitKnowledgeBaseConfigSchema = KnowledgeBaseBaseSchema.extend({
    source: z.literal(KnowledgeBaseSource.Git),
    git: GitSourceConfigSchema
});

/** One knowledge base. A second source is a second member of this union. */
export const KnowledgeBaseConfigSchema = z.discriminatedUnion('source', [GitKnowledgeBaseConfigSchema]);

export type ChunkingConfig = z.infer<typeof ChunkingConfigSchema>;
export type GitSourceConfig = z.infer<typeof GitSourceConfigSchema>;
export type GitKnowledgeBaseConfig = z.infer<typeof GitKnowledgeBaseConfigSchema>;
export type KnowledgeBaseConfig = z.infer<typeof KnowledgeBaseConfigSchema>;
