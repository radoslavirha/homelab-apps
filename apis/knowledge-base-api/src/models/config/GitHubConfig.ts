import { createHash } from 'node:crypto';
import { CommonUtils, ObjectUtils } from '@radoslavirha/utils';
import z from 'zod';
import { GitHubAppConfigSchema } from './GitHubAppConfig.js';
import { GitHubTokenConfigSchema } from './GitHubTokenConfig.js';

/**
 * Runs before the union: an entry without `type` is a GitHub App, as every entry was before
 * tokens. Anything else passes through untouched, so the union still reports it.
 */
const defaultToApp = (value: unknown): unknown => {
    // Raw config: a plain object is all the guard below may assume.
    const raw = value as Record<string, unknown> | null | undefined;

    return ObjectUtils.isPlainObject(raw) && CommonUtils.isUndefined(raw.type) ? { ...raw, type: 'app' } : value;
};

/** What the git source authenticates to GitHub as: a GitHub App, or a token. */
export const GitHubConfigSchema = z.preprocess(defaultToApp, z.discriminatedUnion('type', [GitHubAppConfigSchema, GitHubTokenConfigSchema]));

export type GitHubConfig = z.infer<typeof GitHubConfigSchema>;

/**
 * Tells credentials apart without holding one: an App by its client ID, a token by the file it is
 * read from, or by a hash of an inline value. Safe in a map key; never log it all the same.
 */
export const gitHubCredentialKey = (config: GitHubConfig): string => {
    if (config.type === 'app') {
        return `app:${config.clientId}`;
    }

    return config.token.source === 'file'
        ? `token:file:${config.token.path}`
        : `token:value:${createHash('sha256').update(config.token.value).digest('hex').slice(0, 16)}`;
};
