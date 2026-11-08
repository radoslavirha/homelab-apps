import type { ResolvedTool } from '@tsed/platform-mcp';
import { describe, expect, it } from 'vitest';
import { KnowledgeBaseRole } from '../models/config/KnowledgeBaseRole.enum.js';
import { CreateNoteTool } from '../tools/CreateNoteTool.js';
import { SearchTool } from '../tools/SearchTool.js';
import { UnleveledTool } from '../test/UnleveledTool.js';
import { requiredRoleOf } from './RequireRole.js';

const classTool = (token: ResolvedTool['handler'], propertyKey: string): ResolvedTool => ({ name: propertyKey, handler: () => undefined, token, propertyKey });

describe('requiredRoleOf', () => {
    it('reads the level a tool method\'s @RequireRole declares', () => {
        expect(requiredRoleOf(classTool(SearchTool, 'search'))).toBe(KnowledgeBaseRole.Reader);
        expect(requiredRoleOf(classTool(CreateNoteTool, 'createNote'))).toBe(KnowledgeBaseRole.Editor);
    });

    it('is undefined for a method without one, or with options that are no level', () => {
        expect(requiredRoleOf(classTool(UnleveledTool, 'bare'))).toBeUndefined();
        expect(requiredRoleOf(classTool(UnleveledTool, 'odd'))).toBeUndefined();
    });

    it('is undefined for a tool that is no class method', () => {
        expect(requiredRoleOf({ name: 'fn', handler: () => undefined })).toBeUndefined();
    });
});
