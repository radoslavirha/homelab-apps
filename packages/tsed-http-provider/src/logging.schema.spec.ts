import { describe, expect, it } from 'vitest';
import { DEFAULT_HEADER_REDACT_PATHS, HttpLogConfigSchema } from './logging.schema.js';

describe('HttpLogConfigSchema', () => {
    it('keeps every section disabled when a logging block sets only enabled/stack', () => {
        const parsed = HttpLogConfigSchema.parse({ enabled: true, stack: false });

        expect(parsed.headers.enabled).toBe(false);
        expect(parsed.query.enabled).toBe(false);
        expect(parsed.request.enabled).toBe(false);
        expect(parsed.response.enabled).toBe(false);
    });

    it('keeps the default header redact paths when headers logging is switched on', () => {
        const parsed = HttpLogConfigSchema.parse({ headers: { enabled: true } });

        expect(parsed.headers).toEqual({ enabled: true, redactPaths: DEFAULT_HEADER_REDACT_PATHS });
    });
});
