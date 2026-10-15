import { MetricReader } from '@opentelemetry/sdk-metrics';

/** Collects on demand, with none of the timers a `PeriodicExportingMetricReader` would start. */
export class OnDemandMetricReader extends MetricReader {
    protected onForceFlush(): Promise<void> {
        return Promise.resolve();
    }

    protected onShutdown(): Promise<void> {
        return Promise.resolve();
    }
}
