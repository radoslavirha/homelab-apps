import type { ActionResult, GetPropertiesResult } from '@radoslavirha/miot-device';
import { vi } from 'vitest';

/** Only the four command methods are stubbed — the transport underneath is never reached. */
export class FakeMiotDevice {
    public readonly getProperty = vi.fn(async () => 'sweeping');
    public readonly setProperty = vi.fn(async () => undefined);
    public readonly callAction = vi.fn(
        async (): Promise<ActionResult> => ({ code: 0, result: { did: '1141132187', siid: 2, aiid: 1, code: 0, out: [] } })
    );
    public readonly getProperties = vi.fn(
        async (): Promise<GetPropertiesResult[]> => [{ siid: 2, piid: 1, value: 'sweeping', code: 0 }]
    );
}
