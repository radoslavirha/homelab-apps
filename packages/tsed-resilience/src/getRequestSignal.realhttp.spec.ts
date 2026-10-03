import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PlatformContext } from '@tsed/platform-http';
import { describe, expect, it } from 'vitest';
import { getRequestSignal } from './getRequestSignal.js';

function buildContext(req: http.IncomingMessage, res: http.ServerResponse): PlatformContext {
    const store = new Map<string, unknown>();
    return {
        request: { raw: req },
        response: { raw: res },
        get: (k: string) => store.get(k),
        set: (k: string, v: unknown) => store.set(k, v)
    } as unknown as PlatformContext;
}

async function drain(req: http.IncomingMessage): Promise<void> {
    await new Promise<void>((resolve) => {
        req.on('end', resolve);
        req.resume();
    });
}

describe('getRequestSignal with a real HTTP server', () => {
    it('does not abort while the handler is still running after the request body was consumed', async () => {
        let abortedDuringHandler: boolean | undefined;
        const server = http.createServer(async (req, res) => {
            const signal = getRequestSignal(buildContext(req, res));
            // what any body parser does before the controller runs
            await drain(req);
            await new Promise((r) => setTimeout(r, 100)); // handler still working, client still connected
            abortedDuringHandler = signal.aborted;
            res.end('ok');
        });
        await new Promise<void>((r) => server.listen(0, r));
        const { port } = server.address() as AddressInfo;
        await fetch(`http://localhost:${port}`, { method: 'POST', body: '{"a":1}' }).then((r) => r.text());
        server.close();

        expect(abortedDuringHandler).toBe(false);
    });

    it('aborts when the client disconnects after sending the body', async () => {
        let signal: AbortSignal | undefined;
        let handlerStarted!: () => void;
        const started = new Promise<void>((r) => (handlerStarted = r));
        const server = http.createServer(async (req, res) => {
            signal = getRequestSignal(buildContext(req, res));
            await drain(req);
            handlerStarted();
        });
        await new Promise<void>((r) => server.listen(0, r));
        const { port } = server.address() as AddressInfo;
        const controller = new AbortController();
        fetch(`http://localhost:${port}`, { method: 'POST', body: '{"a":1}', signal: controller.signal }).catch(() => undefined);
        await started;
        expect(signal?.aborted).toBe(false);
        controller.abort();
        await new Promise((r) => setTimeout(r, 100));
        server.closeAllConnections();
        server.close();

        expect(signal?.aborted).toBe(true);
    });
});
