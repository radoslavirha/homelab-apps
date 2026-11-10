import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { CompositePropagator, W3CBaggagePropagator, W3CTraceContextPropagator } from '@opentelemetry/core';
import { SimpleSpanProcessor, TracerProvider, type SpanExporter } from '@opentelemetry/sdk-trace';

/**
 * Registers a global tracer provider that hands every span to `exporter`, with the context
 * manager and propagator an app gets from `NodeSDK`. This is what `NodeTracerProvider#register()`
 * did before OpenTelemetry JS 3 removed it. Undo it with `trace.disable()`, `context.disable()`
 * and `propagation.disable()`.
 */
export const registerTracerProvider = (exporter: SpanExporter): void => {
    trace.setGlobalTracerProvider(new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] }));
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
    propagation.setGlobalPropagator(new CompositePropagator({
        propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()]
    }));
};
