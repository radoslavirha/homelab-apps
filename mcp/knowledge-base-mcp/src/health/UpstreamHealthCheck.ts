import {
    HEALTH_CHECKS,
    HealthStatus,
    breakerCheck,
    type HealthCheck,
    type HealthCheckResult
} from '@radoslavirha/tsed-health';
import { HttpProviderService } from '@radoslavirha/tsed-http-provider';
import { CommonUtils } from '@radoslavirha/utils';
import { Inject, Injectable, ProviderScope, Scope } from '@tsed/di';
import { ExternalApi } from '../models/config/ExternalApi.enum.js';

/**
 * Reports the circuit-breaker state of knowledge-base-api, which every tool calls.
 * **`critical: false`**: a third-party dependency never gates readiness. `/health` shows `warn`;
 * `/health/ready` stays 200.
 *
 * Passive — it reads the breaker that guards real traffic, issues no request of its own. No
 * breaker yet (no call made, or none configured) means no evidence of a fault: `pass`.
 */
@Injectable({ type: HEALTH_CHECKS })
@Scope(ProviderScope.SINGLETON)
export class UpstreamHealthCheck implements HealthCheck {
    public readonly name = 'upstream-apis';
    public readonly critical = false;

    @Inject(HttpProviderService)
    private readonly http!: HttpProviderService<ExternalApi>;

    public check(signal: AbortSignal): HealthCheckResult {
        const breakers = this.http.breakers();
        const degraded: string[] = [];

        for (const api of Object.values(ExternalApi)) {
            const breaker = breakers.get(api);

            if (CommonUtils.isUndefined(breaker)) {
                continue;
            }

            const { status } = breakerCheck(api, breaker).check(signal) as HealthCheckResult;

            if (status !== HealthStatus.Pass) {
                degraded.push(api);
            }
        }

        if (CommonUtils.isEmpty(degraded)) {
            return { status: HealthStatus.Pass };
        }

        return { status: HealthStatus.Warn, detail: `degraded: ${degraded.sort().join(', ')}` };
    }
}
