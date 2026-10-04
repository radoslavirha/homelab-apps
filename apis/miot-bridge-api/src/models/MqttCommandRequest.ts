import { z } from 'zod';
import { DeviceCommandOperation } from './DeviceCommandOperation.enum.js';

/**
 * Command payload for the MQTT transport — a contract with the miniserver, not part of the
 * HTTP API, so it is a Zod schema rather than a Ts.ED model.
 * Device ID is derived from the topic, not the payload. Unknown keys are rejected.
 */
export const MqttCommandRequestSchema = z.strictObject({
    command: z.string().min(1).describe('Miot spec command key (e.g. vacuum:start-sweep).'),
    operation: z.enum(DeviceCommandOperation).describe(`Operation type: ${DeviceCommandOperation.GetProperty}, ${DeviceCommandOperation.SetProperty}, or ${DeviceCommandOperation.Action}.`),
    // Its shape depends on the target property or action; DeviceCommandService validates it against the spec.
    value: z.unknown().optional().describe(`Value for ${DeviceCommandOperation.SetProperty} operations or arguments for ${DeviceCommandOperation.Action} operations (e.g. [1, 2, 3]).`)
});

export type MqttCommandRequest = z.infer<typeof MqttCommandRequestSchema>;
