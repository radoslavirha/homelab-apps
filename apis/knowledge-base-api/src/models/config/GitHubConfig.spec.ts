import { describe, expect, it } from 'vitest';
import type { GitHubAppConfig } from './GitHubAppConfig.js';
import { gitHubCredentialKey } from './GitHubConfig.js';
import type { GitHubTokenConfig } from './GitHubTokenConfig.js';

const OPTIONS = { baseUrl: 'https://api.github.test', timeoutMs: 1000, retries: 0 };
const token = (value: string): GitHubTokenConfig => ({ ...OPTIONS, type: 'token', token: { source: 'value', value } });

describe('gitHubCredentialKey', () => {
    it('names an App by its client ID', () => {
        const app: GitHubAppConfig = { ...OPTIONS, type: 'app', clientId: 'Iv-1', privateKey: { source: 'value', value: 'pem' } };

        expect(gitHubCredentialKey(app)).toBe('app:Iv-1');
    });

    it('names a token by the file it is read from, so a rotation keeps the key', () => {
        expect(gitHubCredentialKey({ ...OPTIONS, type: 'token', token: { source: 'file', path: '/run/secrets/github-token' } }))
            .toBe('token:file:/run/secrets/github-token');
    });

    it('tells inline tokens apart without holding either', () => {
        const first = gitHubCredentialKey(token('github_pat_first'));

        expect(first).not.toContain('github_pat_first');
        expect(first).not.toBe(gitHubCredentialKey(token('github_pat_second')));
        expect(first).toBe(gitHubCredentialKey(token('github_pat_first')));
    });
});
