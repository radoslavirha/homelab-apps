import { describe, expect, it } from 'vitest';
import { ZodValidator } from '@radoslavirha/tsed-common';
import { DeviceCommandOperation } from './DeviceCommandOperation.enum.js';
import { MqttCommandRequestSchema, type MqttCommandRequest } from './MqttCommandRequest.js';

const validate = (input: unknown) => ZodValidator.validate<MqttCommandRequest>(MqttCommandRequestSchema, input);

describe('MqttCommandRequestSchema', () => {
    it('accepts a command without a value', () => {
        expect(validate({ command: 'vacuum:status', operation: DeviceCommandOperation.GetProperty }))
            .toEqual({ command: 'vacuum:status', operation: DeviceCommandOperation.GetProperty });
    });

    // The shape of `value` depends on the target property; DeviceCommandService checks it.
    it.each([1, 'auto', true, [1, 2, 3], ['a']])('passes value %j through unchanged', (value) => {
        expect(validate({ command: 'light:on', operation: DeviceCommandOperation.SetProperty, value }).value).toEqual(value);
    });

    it.each([
        ['a missing operation', { command: 'vacuum:status' }],
        ['an unknown operation', { command: 'vacuum:status', operation: 'REBOOT' }],
        ['an empty command', { command: '', operation: DeviceCommandOperation.Action }],
        ['a numeric command', { command: 1, operation: DeviceCommandOperation.Action }],
        ['an unknown key', { command: 'vacuum:status', operation: DeviceCommandOperation.GetProperty, deviceId: 442 }],
        ['a non-object payload', ['vacuum:status']]
    ])('rejects %s', (_, input) => {
        expect(() => validate(input)).toThrow();
    });
});
