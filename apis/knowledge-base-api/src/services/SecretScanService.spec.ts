import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SecretScanService } from './SecretScanService.js';

// Built at runtime, so no secret-shaped literal sits in this public repository for a scanner to flag.
const join = (...parts: string[]): string => parts.join('');

describe('SecretScanService', () => {
    let secrets: SecretScanService;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        secrets = PlatformTest.get<SecretScanService>(SecretScanService);
    });
    afterEach(PlatformTest.reset);

    it.each([
        ['a private key', join('-----BEGIN OPENSSH ', 'PRIVATE KEY-----')],
        ['a GitHub token', `token ${join('gh', 'p_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8')}`],
        ['a GitHub token', join('github_', 'pat_', '11ABCDEFG0123456789_abcdefghij')],
        ['an AWS access key', join('AK', 'IA', 'ABCDEFGHIJKLMNOP')],
        ['a Slack token', join('xo', 'xb-', '1234567890-abcdef')],
        ['an API key', join('s', 'k-', 'ant-api03-abcdefghij0123456789')],
        ['a JWT', join('ey', 'JhbGciOiJIUzI1NiJ9.', 'ey', 'JzdWIiOiIxMjM0NTY3ODkwIn0.', 'dozjgNryP4J3jVmNHl0w5N')],
        ['a credential in a URL', 'postgres://app:s3cretpw@db.internal:5432/app'],
        ['a secret with its value', 'password: hunter2hunter2'],
        ['a secret with its value', 'CLIENT_SECRET="x8f0aa91b2c3"'],
        ['a secret store path', 'Stored at kv/data/homelab/knowledge-base-mcp.'],
        ['a high-entropy string', join('Zq8vK2mXr9Tb', 'L4wPn7YsH3dF')]
    ])('finds %s', (kind, text) => {
        expect(secrets.scan(text)).toEqual({ line: 1, kind });
    });

    it('says on which line, never what', () => {
        expect(secrets.scan('# Title\n\nSome text.\r\npassword: hunter2hunter2\n')).toEqual({ line: 4, kind: 'a secret with its value' });
    });

    it.each([
        ['the words, without a value', 'The MCP server calls the API with its own token, never the user\'s password or client secret.'],
        ['a word with a value that holds no digit', 'token: the-client-credentials-one'],
        ['a secret store named, not a path', 'The secret lives in OpenBao, at the path the chart names.'],
        ['commit and blob SHAs', 'Pushed at 7a900e7; blob 95b966ae1c166bd92f8ae7d1c313e738c731dfc3, commit 7638417db6d59f3c431d3e1f261cc637155684cd.'],
        ['a UUID', '550e8400-e29b-41d4-a716-446655440000'],
        ['paths and slugs', 'https://github.com/radoslavirha/homelab-apps/blob/main/apis/knowledge-base-api/src/Server.ts and work/2026-10-20-kb-write-tool/spec.md'],
        ['identifiers', 'DocumentsGetResponseVersion2 and ROLE_EDITOR_2026 and knowledge-base-api.editor'],
        ['a URL without a password', 'https://user@github.com/x and http://localhost:4003/health']
    ])('passes %s', (_case, text) => {
        expect(secrets.scan(text)).toBeNull();
    });
});
