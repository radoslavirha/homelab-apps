import { CollectionOf, Description, Enum, MaxLength, MinLength, Pattern, Property, Required } from '@tsed/schema';
import { NoteType } from './NoteType.enum.js';

export class CreateNoteInput {
    @Description('One line stating the decision or fact, 3–200 characters. Also the file name.')
    @Required()
    @MinLength(3)
    @MaxLength(200)
    public title: string;

    @Required()
    @Enum(NoteType)
    public type: NoteType;

    @Description('What prompted it. Two or three sentences.')
    @Required()
    @MinLength(1)
    public context: string;

    @Description('What was decided (a DECISION), or what is true (any other type).')
    @Required()
    @MinLength(1)
    public decisionOrFact: string;

    @Description('Each option rejected, and why. Required for a DECISION; refused for any other type.')
    @CollectionOf(String)
    public alternativesRejected?: string[];

    @Description('What an agent should do differently because of this note.')
    @Property()
    public howToApply?: string;

    @Description('Repository files (GitHub URLs or `<repo>:<path>`), PRs, specs. One line each.')
    @CollectionOf(String)
    public links?: string[];

    @Description('Repositories it touches, e.g. `homelab`, `homelab-apps`.')
    @CollectionOf(String)
    public repos?: string[];

    @Description('When the decision or fact was established, `YYYY-MM-DD`. Default: today.')
    @Pattern(/^\d{4}-\d{2}-\d{2}$/)
    public date?: string;

    @Description('The id of the note this one replaces (a `raw/` id from `search`). It must exist.')
    @Property()
    public supersedes?: string;
}
