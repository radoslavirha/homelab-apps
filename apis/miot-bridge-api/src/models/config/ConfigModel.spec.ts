import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigSchema, DEVICE_SECRET_REDACT_PATHS } from './ConfigModel.js';

const testConfig = (): Record<string, unknown> =>
    JSON.parse(readFileSync(resolve(process.cwd(), 'config/test.json'), 'utf-8')) as Record<string, unknown>;

describe('ConfigSchema', () => {
    // The HTTP notification sink was removed. During a rolling deploy the new image can read a
    // ConfigMap written for the old one, so a leftover `http` block must not fail the boot.
    it('Should accept and ignore a legacy http.notifications block', () => {
        const result = ConfigSchema.safeParse({
            ...testConfig(),
            http: { notifications: { enabled: true, address: 'http://192.168.1.140:5001/notify' } }
        });

        expect(result.success).toBe(true);
        expect(result.data).not.toHaveProperty('http');
    });

    describe('logger body redaction', () => {
        const parse = (logger?: unknown) => {
            const base = { ...testConfig(), logger };
            return ConfigSchema.parse(base).logger.requests;
        };

        it('Should redact device secrets by default', () => {
            expect(parse().request.redactPaths).toEqual(DEVICE_SECRET_REDACT_PATHS);
            expect(parse({}).response.redactPaths).toEqual(DEVICE_SECRET_REDACT_PATHS);
        });

        it('Should let a configured list replace the default', () => {
            const requests = parse({ requests: { response: { redactPaths: ['secret'] } } });

            expect(requests.response.redactPaths).toEqual(['secret']);
            expect(requests.request.redactPaths).toEqual(DEVICE_SECRET_REDACT_PATHS);
        });

        it('Should let an explicit empty list opt out', () => {
            expect(parse({ requests: { request: { redactPaths: [] } } }).request.redactPaths).toEqual([]);
        });
    });
});
