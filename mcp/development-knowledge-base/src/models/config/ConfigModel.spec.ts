import { describe, expect, it } from 'vitest';
import { ConfigSchema } from './ConfigModel.js';

const MINIMAL = { server: { httpPort: 4004 } };

describe('ConfigSchema', () => {
    it('accepts the minimal config: every section beyond the server is optional', () => {
        expect(ConfigSchema.safeParse(MINIMAL).success).toBe(true);
    });

    it('accepts a full local config', () => {
        const result = ConfigSchema.safeParse({
            ...MINIMAL,
            health: {},
            logger: { level: 'info' },
            otel: { traces: { enabled: false, exporter: { url: 'http://localhost:4318/v1/traces' } } }
        });

        expect(result.success).toBe(true);
    });

    it('keeps a key it does not know yet, so a newer config does not stop an older pod', () => {
        // The repository-wide rule: config changes are additive across a rolling deploy.
        expect(ConfigSchema.safeParse({ ...MINIMAL, upstream: { url: 'https://api.test' } }).success).toBe(true);
    });

    it('refuses a port that is not a number, naming the field', () => {
        const result = ConfigSchema.safeParse({ server: { httpPort: 'not-a-port' } });

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['server', 'httpPort']);
    });

    it('refuses a log level the logger does not have', () => {
        expect(ConfigSchema.safeParse({ ...MINIMAL, logger: { level: 'chatty' } }).success).toBe(false);
    });
});
