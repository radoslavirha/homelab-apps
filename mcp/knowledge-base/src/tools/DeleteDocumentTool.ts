import type { CallToolResult } from '@modelcontextprotocol/server';
import { Injectable } from '@tsed/di';
import { Tool } from '@tsed/platform-mcp';
import { Description, Returns } from '@tsed/schema';
import { RequireRole } from '../auth/RequireRole.js';
import { DeleteDocumentHandler } from '../handlers/DeleteDocumentHandler.js';
import { KnowledgeBaseRole } from '../models/config/KnowledgeBaseRole.enum.js';
import { DeleteDocumentInput } from '../models/DeleteDocumentInput.js';
import { DeleteDocumentOutput } from '../models/DeleteDocumentOutput.js';

@Injectable()
export class DeleteDocumentTool {
    public constructor(private readonly handler: DeleteDocumentHandler) {}

    @Tool('delete_document', { title: 'Delete a document', annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false } })
    @Description(
        'Delete a note (`raw/`) or a spec or plan (`work/`) from the knowledge base: one commit, made for the signed-in user, with ' +
        'the reason in it. Git history keeps the document. ' +
        'Only for a mistake or a dead document. A note whose meaning changed is not deleted: `create_note` a new one that ' +
        '`supersedes` it. ' +
        'Before calling, tell the user which document goes and why, and get their yes. ' +
        'Pass the version you read or last wrote. If the document changed meanwhile, the result is an error holding it under ' +
        '`current`: show the user, and delete with `current.version` only if they still want it gone.'
    )
    @RequireRole(KnowledgeBaseRole.Editor)
    @Returns(200, DeleteDocumentOutput)
    public deleteDocument(input: DeleteDocumentInput): Promise<DeleteDocumentOutput | CallToolResult> {
        return this.handler.execute(input);
    }
}
