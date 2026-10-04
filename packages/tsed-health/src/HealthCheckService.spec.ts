import { HealthStatus } from '@radoslavirha/health';
import { injectable } from '@tsed/di';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HEALTH_CHECKS } from './HEALTH_CHECKS.js';
import { HealthCheckService } from './HealthCheckService.js';
import { TestHealthProvider } from './test/TestHealthProvider.js';

const check = vi.fn();

injectable(Symbol.for('test:hcs:counted'))
    .type(HEALTH_CHECKS)
    .factory(() => ({ name: 'counted', critical: true, check }))
    .token();

describe('HealthCheckService', () => {
    beforeEach(() => {
        check.mockReset();
        check.mockReturnValue({ status: HealthStatus.Pass });
        TestHealthProvider.configure({ cacheTtlMs: 0 });
    });
    beforeEach(PlatformTest.create);
    afterEach(PlatformTest.reset);

    it('Should evaluate each check once per evaluate() call', async () => {
        const service = PlatformTest.get<HealthCheckService>(HealthCheckService);

        await service.evaluate();

        expect(check).toHaveBeenCalledTimes(1);
    });
});
