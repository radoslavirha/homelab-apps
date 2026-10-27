import { AdditionalProperties, Description, Example, MinLength, Optional, Pattern, Property, Required } from '@tsed/schema';
import { KNOWLEDGE_BASE_ID_PATTERN } from './KnowledgeBaseId.js';

@Description('A whole work/ document — a spec or a plan — to create or rewrite.')
@AdditionalProperties(false)
export class DocumentsPutRequest {
    @Description('Knowledge base id.')
    @Required()
    @Pattern(KNOWLEDGE_BASE_ID_PATTERN)
    @Example('development')
    public kb: string;

    @Description('work/<YYYY-MM-DD>-<kebab-slug>/spec.md or plan.md. The folder is created when it is new.')
    @Required()
    @MinLength(1)
    @Example('work/2026-10-20-kb-write-tool/spec.md')
    public id: string;

    @Description('The whole markdown, frontmatter included (status, repos, created).')
    @Required()
    @MinLength(1)
    public content: string;

    @Description('Required to rewrite: the version the change was made to — from GET /documents, the last write, or a 409\'s current document. Absent to create.')
    @Optional()
    @Property(String)
    public version?: string;

    @Description('Why, in a line or a paragraph. The commit message\'s body.')
    @Optional()
    @Property(String)
    public message?: string;
}
