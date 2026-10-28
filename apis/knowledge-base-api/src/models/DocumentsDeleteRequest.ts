import { AdditionalProperties, Description, Example, MinLength, Pattern, Required } from '@tsed/schema';
import { KNOWLEDGE_BASE_ID_PATTERN } from './KnowledgeBaseId.js';

@Description('A raw/ note or a work/ document to delete.')
@AdditionalProperties(false)
export class DocumentsDeleteRequest {
    @Description('Knowledge base id.')
    @Required()
    @Pattern(KNOWLEDGE_BASE_ID_PATTERN)
    @Example('development')
    public kb: string;

    @Required()
    @MinLength(1)
    @Example('raw/2026-10-20-mistaken-note.md')
    public id: string;

    @Description('The version being deleted — from GET /documents, the last write, or a 409\'s current document.')
    @Required()
    @MinLength(1)
    public version: string;

    @Description('Why it goes. Kept in the commit message.')
    @Required()
    @MinLength(1)
    public reason: string;
}
