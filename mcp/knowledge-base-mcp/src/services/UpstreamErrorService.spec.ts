import { BadGateway, BadRequest, Conflict, GatewayTimeout, NotFound, NotImplemented } from '@tsed/exceptions';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UpstreamErrorService } from './UpstreamErrorService.js';

/** As http-provider reports an upstream answer: a BadGateway whose origin is the Axios error. */
const upstream = (status: number, data?: unknown): BadGateway => new BadGateway(
    `External API KNOWLEDGE_BASE_API responded with ${status}`,
    Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } })
);

/** Ts.ED's exception body, as knowledge-base-api answers a stale version. */
const STALE = {
    name: 'CONFLICT',
    message: 'work/2026-10-20-x/spec.md has changed since version b1. Apply your change to the current document and write it with its version.',
    status: 409,
    errors: [{ name: 'CURRENT', message: 'The document as the source holds it now.', content: '# Now', version: 'b2' }]
};

describe('UpstreamErrorService', () => {
    let errors: UpstreamErrorService;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        errors = PlatformTest.get<UpstreamErrorService>(UpstreamErrorService);
    });
    afterEach(PlatformTest.reset);

    describe('status', () => {
        it('is the status the API answered with', () => {
            expect(errors.status(upstream(404))).toBe(404);
        });

        it('is undefined when the API did not answer, or the error is no HTTP exception', () => {
            expect(errors.status(new GatewayTimeout('did not respond in time'))).toBeUndefined();
            expect(errors.status(new TypeError('x'))).toBeUndefined();
        });
    });

    describe('status (token request)', () => {
        it('is undefined when the failed request was the token endpoint\'s, not the API\'s', () => {
            const token = new BadGateway('responded with 400', Object.assign(new Error('x'), { config: { url: 'https://auth.test/token' }, response: { status: 400 } }));

            expect(errors.status(token)).toBeUndefined();
        });
    });

    describe('refusal', () => {
        it('answers a 409 carrying the current document with a tool error holding it, intact, under `current`', () => {
            const result = errors.refusal(upstream(409, STALE));
            const expected = { status_code: 409, code: 'E_MCP_TOOL_CONFLICT', message: STALE.message, current: { content: '# Now', version: 'b2' } };

            expect(result.isError).toBe(true);
            expect(result.structuredContent).toEqual(expected);
            expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(expected, null, 2) }]);
        });

        it('keeps a current document that is empty: it is still the document', () => {
            const result = errors.refusal(upstream(409, { ...STALE, errors: [{ ...STALE.errors[0], content: '' }] }));

            expect(result.structuredContent).toEqual(expect.objectContaining({ current: { content: '', version: 'b2' } }));
        });

        it('throws a 409 without the current document as a conflict, with the API\'s message', () => {
            const body = { name: 'CONFLICT', message: 'The source refused to create work/x/spec.md twice, though it does not exist. Try again.', status: 409, errors: [] };

            expect(() => errors.refusal(upstream(409, body))).toThrow(new Conflict(body.message));
        });

        it.each([
            [400, BadRequest, 'The note is not valid: alternativesRejected is required for a DECISION.'],
            [404, NotFound, 'work/2026-10-20-x/spec.md no longer exists.'],
            [501, NotImplemented, 'Knowledge base home has a paperless source, which cannot be written.']
        ])('throws a %i as the matching tool error, with the API\'s message', (status, type, message) => {
            expect(() => errors.refusal(upstream(status, { name: 'X', message, status, errors: [] }))).toThrow(new type(message));
        });

        it('falls back to the error\'s own message when the API sent no body it explains itself in', () => {
            const error = upstream(404, 'Not Found');

            expect(() => errors.refusal(error)).toThrow(new NotFound(error.message));
        });

        it('throws anything else as it is: no answer, a status the API does not explain, no HTTP exception', () => {
            const timeout = new GatewayTimeout('did not respond in time');
            const forbidden = upstream(403, { name: 'FORBIDDEN', message: 'Forbidden', status: 403 });
            const bug = new TypeError('x');

            expect(() => errors.refusal(timeout)).toThrow(timeout);
            expect(() => errors.refusal(forbidden)).toThrow(forbidden);
            expect(() => errors.refusal(bug)).toThrow(bug);
        });
    });
});
