import { AdditionalProperties, Description, Example, Required } from '@tsed/schema';

@Description('The note was committed.')
@AdditionalProperties(false)
export class NotesPostResponse {
    @Description('The new note\'s id.')
    @Required()
    @Example('raw/2026-10-20-mongodb-stays-on-latest.md')
    public id: string;

    @Description('Its version (for git, the blob SHA): what a later write of it passes.')
    @Required()
    public version: string;

    @Description('The commit the write made.')
    @Required()
    public commit: string;
}
