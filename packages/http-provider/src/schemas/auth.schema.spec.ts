import { describe, expect, it } from 'vitest';
import { AuthConfigSchema } from './auth.schema.js';

describe('AuthConfigSchema', () => {
    describe('no strategy', () => {
        it('rejects a transport entry naming a credential no strategy will produce', () => {
            // A k8s config that lost its `strategy` line: nothing produces `value`.
            const result = AuthConfigSchema.safeParse({
                tokenPath: '/run/secrets/sa/token',
                transport: { headers: [{ name: 'Authorization', credential: 'value', prefix: 'Bearer ' }] }
            });

            expect(result.success).toBe(false);
        });

        it('rejects a credential entry with strategy none', () => {
            const result = AuthConfigSchema.safeParse({
                strategy: 'none',
                transport: { queryParams: [{ name: 'key', credential: 'value' }] }
            });

            expect(result.success).toBe(false);
        });

        it('accepts static transport entries', () => {
            const result = AuthConfigSchema.safeParse({
                transport: {
                    headers: [{ name: 'X-Api-Key', value: 'secret' }],
                    queryParams: [{ name: 'key', value: 'secret' }]
                }
            });

            expect(result.success).toBe(true);
        });
    });
});
