import { AdditionalProperties, CollectionOf, Description, Enum, Example, Format, MaxLength, MinLength, Optional, Pattern, Property, Required } from '@tsed/schema';
import { KNOWLEDGE_BASE_ID_PATTERN } from './KnowledgeBaseId.js';
import { NoteType } from './NoteType.enum.js';

@Description('A new raw/ note, as fields: the API renders the file, so its frontmatter cannot be malformed.')
@AdditionalProperties(false)
export class NotesPostRequest {
    @Description('Knowledge base id.')
    @Required()
    @Pattern(KNOWLEDGE_BASE_ID_PATTERN)
    @Example('development')
    public kb: string;

    @Description('One line stating the decision or fact. Also the file name\'s slug.')
    @Required()
    @MinLength(3)
    @MaxLength(200)
    @Pattern(/^[^\r\n]+$/)
    @Example('MongoDB stays on :latest')
    public title: string;

    @Required()
    @Enum(NoteType)
    @Example(NoteType.Decision)
    public type: NoteType;

    @Description('What prompted it. Two or three sentences.')
    @Required()
    @MinLength(1)
    public context: string;

    @Description('What was decided (a decision), or what is true (any other type).')
    @Required()
    @MinLength(1)
    public decisionOrFact: string;

    @Description('Each option rejected, and why. Required for a DECISION; refused for any other type.')
    @Optional()
    @CollectionOf(String)
    public alternativesRejected?: string[];

    @Description('What an agent should do differently because of this note.')
    @Optional()
    @Property(String)
    public howToApply?: string;

    @Description('Repo files (GitHub URLs or <repo>:<path>), PRs, specs. One line each.')
    @Optional()
    @CollectionOf(String)
    public links?: string[];

    @Description('Repos it touches. Default: none.')
    @Optional()
    @CollectionOf(String)
    @Example(['homelab', 'homelab-apps'])
    public repos?: string[];

    @Description('When the decision or fact was established. Default: today (UTC).')
    @Optional()
    @Format('date')
    @Example('2026-10-20')
    public date?: string;

    @Description('The id of the note this one replaces. It must exist.')
    @Optional()
    @Property(String)
    @Example('raw/2026-09-06-old.md')
    public supersedes?: string;
}
