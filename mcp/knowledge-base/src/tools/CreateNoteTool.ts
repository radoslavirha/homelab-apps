import type { CallToolResult } from '@modelcontextprotocol/server';
import { Injectable } from '@tsed/di';
import { Tool } from '@tsed/platform-mcp';
import { Description, Returns } from '@tsed/schema';
import { RequireRole } from '../auth/RequireRole.js';
import { CreateNoteHandler } from '../handlers/CreateNoteHandler.js';
import { KnowledgeBaseRole } from '../models/config/KnowledgeBaseRole.enum.js';
import { CreateNoteInput } from '../models/CreateNoteInput.js';
import { CreateNoteOutput } from '../models/CreateNoteOutput.js';

@Injectable()
export class CreateNoteTool {
    public constructor(private readonly handler: CreateNoteHandler) {}

    @Tool('create_note', { title: 'Create a note', annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } })
    @Description(
        'Add a note to the knowledge base: one commit, under `raw/`, made for the signed-in user. ' +
        'Write one for what someone will need later and cannot get from the repositories: a decision together with the alternatives ' +
        'rejected and why (a DECISION requires `alternativesRejected`), a contract between repositories (MQTT topics, REST endpoints, ' +
        'URLs, auth), or a gotcha that cost time. ' +
        'Not for what the code or a repository\'s own docs already say, not for progress updates or chat summaries, and never for ' +
        'anything personal or secret — the knowledge base is written as if public, and a secret is refused. ' +
        '`search` first: if a note already covers it, write a new one that `supersedes` it instead of a duplicate. Notes are never ' +
        'rewritten. ' +
        'Before calling, show the user the full note and get their yes; call only with what they approved. ' +
        'If a note with this title and date already exists, the result is an error holding it under `current`: show the user, and ' +
        'change the title if theirs is a different note. ' +
        'After a timeout the note may have landed: `search` or `read` for it before retrying.'
    )
    @RequireRole(KnowledgeBaseRole.Editor)
    @Returns(200, CreateNoteOutput)
    public createNote(input: CreateNoteInput): Promise<CreateNoteOutput | CallToolResult> {
        return this.handler.execute(input);
    }
}
