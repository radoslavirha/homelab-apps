import {
    HEALTH_CHECKS,
    HealthStatus,
    type HealthCheck,
    type HealthCheckResult
} from '@radoslavirha/tsed-health';
import { Inject, Injectable, ProviderScope, Scope } from '@tsed/di';
import { PostgresService } from '../storage/postgres/PostgresService.js';

/**
 * The database this pod answers from — `critical: true`: without it there is no search, no
 * document and no status, so the pod leaves the Service's endpoints until it is back.
 *
 * A `SELECT 1` per probe, unlike the Mongo check's field read: a pg pool has no connection
 * state to read, and a round trip is the only honest answer. Its span is suppressed by the
 * pg instrumentation's `requireParentSpan`, since probe paths are not traced.
 */
@Injectable({ type: HEALTH_CHECKS })
@Scope(ProviderScope.SINGLETON)
export class PostgresHealthCheck implements HealthCheck {
    public readonly name = 'postgres';
    public readonly critical = true;

    @Inject(PostgresService)
    private readonly postgres!: PostgresService;

    public async check(signal: AbortSignal): Promise<HealthCheckResult> {
        try {
            await Promise.race([
                this.postgres.ping(),
                new Promise<never>((_resolve, reject) => {
                    signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
                })
            ]);

            return { status: HealthStatus.Pass };
        } catch {
            // No error text: /health is readable by anything that reaches the pod.
            return { status: HealthStatus.Fail, detail: signal.aborted ? 'timeout' : 'unreachable' };
        }
    }
}
