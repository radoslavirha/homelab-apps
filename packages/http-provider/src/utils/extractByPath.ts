import { NumberUtils, ObjectUtils, StringUtils } from '@radoslavirha/utils';

/**
 * Extracts a value from an object by dot-notation path.
 * The path is relative to the object itself (not `response.data`).
 *
 * @example
 * extractByPath({ access_token: 'abc' }, 'access_token') // 'abc'
 * extractByPath({ data: { token: 'abc' } }, 'data.token') // 'abc'
 */
export function extractByPath(obj: unknown, path: string): string {
    const current = resolvePath(obj, path);
    if (!StringUtils.isString(current)) {
        throw new Error(`Extracted value at path "${path}" is not a string (got ${typeof current})`);
    }
    return current;
}

/**
 * Extracts a number (or a numeric string, as some token endpoints send `expires_in`)
 * from an object by dot-notation path.
 */
export function extractNumberByPath(obj: unknown, path: string): number {
    const current = resolvePath(obj, path);
    const value = StringUtils.isString(current) ? Number(StringUtils.isNotEmpty(String(current).trim()) ? String(current) : NaN) : current;
    if (!NumberUtils.isFiniteNumber(value)) {
        throw new Error(`Extracted value at path "${path}" is not a number (got ${typeof current})`);
    }
    return value;
}

function resolvePath(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
        if (!ObjectUtils.isObject(current)) {
            throw new Error(`Cannot extract path "${path}": "${part}" is not an object`);
        }
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}
