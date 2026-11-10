import { describe, expect, it } from 'vitest';
import { OtelConfigSchema } from './OtelConfig.js';

describe('OtelConfigSchema', () => {
    describe('resourceAttributes', () => {
        it('Should accept string, number and boolean values', () => {
            const resourceAttributes = { 'deployment.environment.name': 'production', 'k8s.node.count': 3, 'app.canary': false };

            expect(OtelConfigSchema.parse({ resourceAttributes })).toEqual({ resourceAttributes });
        });

        it('Should be optional', () => {
            expect(OtelConfigSchema.parse({})).toEqual({});
        });

        it.each(['service.name', 'service.version'])('Should reject %s, which the app sets itself', (key) => {
            const result = OtelConfigSchema.safeParse({ resourceAttributes: { [key]: 'x' } });

            expect(result.success).toBe(false);
        });

        it.each([
            ['an object', { nested: true }],
            ['an array', ['a']],
            ['null', null]
        ])('Should reject %s as a value', (_label, value) => {
            expect(OtelConfigSchema.safeParse({ resourceAttributes: { key: value } }).success).toBe(false);
        });

        it('Should reject an empty key', () => {
            expect(OtelConfigSchema.safeParse({ resourceAttributes: { '': 'x' } }).success).toBe(false);
        });
    });
});
