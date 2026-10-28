import type { CallToolResult } from '@modelcontextprotocol/server';
import { Injectable } from '@tsed/di';
import { Tool } from '@tsed/platform-mcp';
import { Description, Returns } from '@tsed/schema';
import { RequireRole } from '../auth/RequireRole.js';
import { WriteDocumentHandler } from '../handlers/WriteDocumentHandler.js';
import { KnowledgeBaseRole } from '../models/config/KnowledgeBaseRole.enum.js';
import { WriteDocumentInput } from '../models/WriteDocumentInput.js';
import { WriteDocumentOutput } from '../models/WriteDocumentOutput.js';

@Injectable()
export class WriteDocumentTool {
    public constructor(private readonly handler: WriteDocumentHandler) {}

    @Tool('write_document', { title: 'Write a spec or plan', annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } })
    @Description(
        'Create or rewrite a whole spec or plan under `work/` in the knowledge base: one commit, made for the signed-in user. ' +
        'For a spec or plan the user is shaping for work across repositories — not for what the code or a repository\'s own docs ' +
        'already say, not for progress updates, and never for anything personal or secret (a secret is refused). ' +
        '`search` first: rewrite the spec that exists rather than starting a second one. ' +
        'Send the whole markdown, frontmatter included; there are no partial edits. Before calling, show the user the full ' +
        'document (or exactly what changes) and get their yes. ' +
        'To create, leave out `version`. To rewrite, pass the version your change was made to: from `read`, or the `version` your ' +
        'last write of it returned — keep that one for the next edit; there is no need to `read` again. ' +
        'If the document changed meanwhile, the result is an error holding it under `current`: apply your change to ' +
        '`current.content`, show the user the result again (it is not what they approved), and retry with `current.version`.'
    )
    @RequireRole(KnowledgeBaseRole.Editor)
    @Returns(200, WriteDocumentOutput)
    public writeDocument(input: WriteDocumentInput): Promise<WriteDocumentOutput | CallToolResult> {
        return this.handler.execute(input);
    }
}
