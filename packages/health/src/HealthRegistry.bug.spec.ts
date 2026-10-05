import { describe, expect, it } from 'vitest';
import { HealthRegistry } from './HealthRegistry.js';
import type { HealthCheck } from './HealthCheck.js';
import { HealthStatus } from './HealthStatus.enum.js';

describe('HealthRegistry', () => {
    it('Should keep evaluating after a check throws an Error whose name is not a string', async () => {
        let calls = 0;
        const flaky: HealthCheck = {
            name: 'flaky',
            critical: true,
            check: () => {
                calls++;
                if (calls === 1) {
                    const error = new Error('odd');
                    (error as unknown as { name: unknown }).name = undefined;
                    throw error;
                }
                return { status: HealthStatus.Pass };
            }
        };
        const registry = new HealthRegistry([flaky], { cacheTtlMs: 0 });

        const first = await registry.evaluate();
        expect(first.ready).toBe(false);

        await expect(registry.evaluate()).resolves.toMatchObject({ ready: true });
        expect(calls).toBe(2);
    });
});
