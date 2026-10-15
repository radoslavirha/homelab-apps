import { createResiliencePolicy, type ResiliencePolicy } from '../ResiliencePolicy.js';
import { isTaskCancelledError } from '../errors.js';
import { HttpStatusError } from './HttpStatusError.js';

const RETRIABLE_STATUS_CODES = new Set<number>([408, 429, 500, 502, 503, 504]);
export type HttpScenario<T> =
    | { kind: 'success'; value: T; delayMs?: number; onStart?: () => void }
    | { kind: 'status'; status: number; delayMs?: number; onStart?: () => void }
    | { kind: 'network'; message: string; delayMs?: number; onStart?: () => void }
    | { kind: 'never'; onStart?: () => void };

const waitForDelay = async (delayMs: number, signal: AbortSignal): Promise<void> => {
    if (delayMs <= 0) {
        return;
    }

    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, delayMs);

        const onAbort = (): void => {
            clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
            reject(new Error('aborted'));
        };

        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) {
            onAbort();
        }
    });
};

export const isRetriableHttpError = (error: unknown): boolean => {
    if (isTaskCancelledError(error)) {
        return false;
    }

    if (error instanceof HttpStatusError) {
        return RETRIABLE_STATUS_CODES.has(error.status);
    }

    return true;
};

export class HttpProviderHarness<T> {
    private readonly policy: ResiliencePolicy;
    private readonly scenarios: HttpScenario<T>[];
    private attemptCount: number = 0;

    public constructor(scenarios: HttpScenario<T>[], policy: ResiliencePolicy = createResiliencePolicy({
        retry: { count: 2, backoffMs: 0 },
        timeout: { ms: 1000 },
        circuitBreaker: {}
    }, {
        shouldHandle: isRetriableHttpError
    })) {
        this.scenarios = [...scenarios];
        this.policy = policy;
    }

    public get attempts(): number {
        return this.attemptCount;
    }

    public async get(signal?: AbortSignal): Promise<T> {
        return this.policy.execute(async (requestSignal) => this.dispatch(requestSignal), signal);
    }

    private async dispatch(signal: AbortSignal): Promise<T> {
        const scenario = this.scenarios.shift();
        if (!scenario) {
            throw new Error('No HTTP scenario prepared for this call');
        }

        this.attemptCount += 1;
        scenario.onStart?.();

        if (scenario.kind === 'never') {
            return new Promise<never>(() => {
                // keep pending until caller/timeout cancels through resilience
            });
        }

        await waitForDelay(scenario.delayMs ?? 0, signal);

        if (scenario.kind === 'status') {
            throw new HttpStatusError(scenario.status);
        }

        if (scenario.kind === 'network') {
            throw new Error(scenario.message);
        }

        return scenario.value;
    }
}
