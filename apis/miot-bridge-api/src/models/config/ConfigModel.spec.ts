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

    // The JSON file storage was removed; the homelab ConfigMaps still set `cachePath`.
    it('Should accept and ignore a legacy cachePath', () => {
        const result = ConfigSchema.safeParse({ ...testConfig(), cachePath: './cache' });

        expect(result.success).toBe(true);
        expect(result.data).not.toHaveProperty('cachePath');
    });

    describe('mongodb', () => {
        // MongoDB is the only storage: without it the pod would boot and fail every request.
        it.each([
            ['missing', undefined],
            ['disabled', { enabled: false, url: 'mongodb://mongo.home:27017/miot' }],
            ['enabled without a url', { enabled: true }]
        ])('Should refuse a %s block', (_, mongodb) => {
            const result = ConfigSchema.safeParse({ ...testConfig(), mongodb });

            expect(result.success).toBe(false);
            expect(result.error?.issues.map((issue) => issue.path[0])).toContain('mongodb');
        });
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
