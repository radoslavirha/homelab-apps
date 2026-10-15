import type { Principal } from '@radoslavirha/auth';
import { PrincipalService } from '@radoslavirha/tsed-auth';
import { NotFound, Unauthorized } from '@tsed/exceptions';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// registers the AuthenticationService override bound to this API's config
import '../providers/AuthProvider.js';
import type { KnowledgeBaseConfig } from '../models/config/KnowledgeBaseConfig.js';
import { ConfigService } from './ConfigService.js';
import { KnowledgeBaseAccessService } from './KnowledgeBaseAccessService.js';

const caller = (...roles: string[]): Principal => ({ subject: 's', kind: 'human', roles, issuer: 'i' });

describe('KnowledgeBaseAccessService', () => {
    let access: KnowledgeBaseAccessService;
    let principals: PrincipalService;

    /** The caller of the request being handled, as `PrincipalService` would read it. */
    const callerHolds = (...roles: string[]): void => {
        vi.spyOn(principals, 'require').mockReturnValue(caller(...roles));
    };

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        // `config/test.json` has one knowledge base; three tell readable from unreadable.
        const configService = PlatformTest.get<ConfigService>(ConfigService);
        const [dev] = configService.config.knowledgeBases;
        const knowledgeBases: KnowledgeBaseConfig[] = [
            dev,
            { ...dev, id: 'home', readers: ['household'] },
            { ...dev, id: 'both', readers: ['knowledge-base-api.reader', 'household'] }
        ];

        vi.spyOn(configService, 'config', 'get').mockReturnValue({ ...configService.config, knowledgeBases });
        principals = PlatformTest.get<PrincipalService>(PrincipalService);
        access = PlatformTest.get<KnowledgeBaseAccessService>(KnowledgeBaseAccessService);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.restoreAllMocks());

    it('gives a caller the knowledge bases whose readers share a role with it', () => {
        callerHolds('household');
        expect(access.readable().map((kb) => kb.id)).toEqual(['home', 'both']);

        callerHolds();
        expect(access.readable().map((kb) => kb.id)).toEqual([]);
    });

    it('defaults to every readable knowledge base', () => {
        callerHolds('knowledge-base-api.reader');

        expect(access.resolve(undefined).map((kb) => kb.id)).toEqual(['dev', 'both']);
    });

    it('narrows to the named ones, de-duplicated', () => {
        callerHolds('knowledge-base-api.reader');

        expect(access.resolve(' both,dev,both ').map((kb) => kb.id)).toEqual(['both', 'dev']);
    });

    it('answers the same 404 for an unreadable and a missing knowledge base', () => {
        callerHolds('knowledge-base-api.reader');

        expect(() => access.resolve('home')).toThrow(new NotFound('Knowledge base not found.'));
        expect(() => access.resolve('nope')).toThrow(new NotFound('Knowledge base not found.'));
    });

    it('answers 401 with no caller, rather than reading as one with no roles', () => {
        expect(() => access.readable()).toThrow(new Unauthorized('Authentication required.'));
    });
});
