import { CommonUtils } from '@radoslavirha/utils';
import { runInContext } from '@tsed/di';
import { Forbidden } from '@tsed/exceptions';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateNoteHandler } from '../handlers/CreateNoteHandler.js';
import { CreateNoteInput } from '../models/CreateNoteInput.js';
import { CreateNoteOutput } from '../models/CreateNoteOutput.js';
import { NoteType } from '../models/NoteType.enum.js';
import { TEST_ROLES } from '../test/fixtures.js';
import { CreateNoteTool } from '../tools/CreateNoteTool.js';

/** Runs `fn` as a request to /development by a caller holding `roles`, as platform-mcp's dispatch would. */
const asCallerWith = <T>(roles: string[], fn: () => T): Promise<T> => {
    const auth = { extra: { principal: { subject: 's', kind: 'human', roles, issuer: 'https://issuer.test/' } } };
    const ctx = PlatformTest.createRequestContext({ event: { request: PlatformTest.createRequest({ url: '/development', originalUrl: '/development', auth }), response: PlatformTest.createResponse() } });

    return runInContext(ctx, fn);
};

const NOTE = CommonUtils.buildModelPartial(CreateNoteInput, { title: 'A gotcha', type: NoteType.Gotcha, context: 'c', decisionOrFact: 'd' });

/**
 * The per-call check behind `tools/list`'s filter: a caller is never shown a tool above its level,
 * so through MCP the tool is simply not there. Called on the tool itself, the check still holds.
 */
describe('RoleInterceptor', () => {
    let tool: CreateNoteTool;
    let handler: CreateNoteHandler;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        tool = PlatformTest.get<CreateNoteTool>(CreateNoteTool);
        handler = PlatformTest.get<CreateNoteHandler>(CreateNoteHandler);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('refuses a caller below the tool\'s level before its handler runs', async () => {
        expect.assertions(2);

        const execute = vi.spyOn(handler, 'execute');

        await expect(asCallerWith([TEST_ROLES.READER], () => tool.createNote(NOTE))).rejects.toThrow(new Forbidden('Insufficient permissions.'));
        expect(execute).not.toHaveBeenCalled();
    });

    it('lets a caller holding the tool\'s level through to its handler', async () => {
        expect.assertions(1);

        const execute = vi.spyOn(handler, 'execute').mockResolvedValue(CommonUtils.buildModelStrict(CreateNoteOutput, { id: 'raw/x.md', version: 'b1', commit: 'c1' }));

        await asCallerWith([TEST_ROLES.EDITOR], () => tool.createNote(NOTE));

        expect(execute).toHaveBeenCalledTimes(1);
    });
});
