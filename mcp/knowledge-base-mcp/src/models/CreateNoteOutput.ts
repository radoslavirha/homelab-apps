import { Description, Property, Required } from '@tsed/schema';

@Description('The note was committed.')
export class CreateNoteOutput {
    @Description('The new note\'s id.')
    @Required()
    @Property()
    public id: string;

    @Description('Its version. Notes are append-only: a later change is a new note that supersedes it.')
    @Required()
    @Property()
    public version: string;

    @Description('The commit the write made.')
    @Required()
    @Property()
    public commit: string;
}
