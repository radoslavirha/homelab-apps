import { context, metrics, propagation, trace } from '@opentelemetry/api';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:module', () => ({ register: vi.fn() }));

const { OpenTelemetryService } = await import('./OpenTelemetryService.js');

const exporter = { url: 'http://collector.invalid:4318/v1/x' };

describe('OpenTelemetryService — omitted signals', () => {
    let service: InstanceType<typeof OpenTelemetryService>;

    afterEach(async () => {
        await service.shutdown(100);
        trace.disable();
        metrics.disable();
        context.disable();
        propagation.disable();
    });

    it('Should not record or export spans when traces are omitted (metrics only)', () => {
        service = new OpenTelemetryService();
        service.init({ otel: { metrics: { enabled: true, exporter } }, service: 's', version: '1' });

        const span = trace.getTracer('probe').startSpan('probe');
        expect(span.isRecording()).toBe(false);
        span.end();
    });

    it('Should not register a meter provider when metrics are omitted (traces only)', () => {
        service = new OpenTelemetryService();
        service.init({ otel: { traces: { enabled: true, exporter } }, service: 's', version: '1' });

        expect(metrics.getMeterProvider().constructor.name).toBe('NoopMeterProvider');
    });
});
