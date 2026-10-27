import { AdditionalProperties, Description, Example, Required } from '@tsed/schema';

@Description('The document was deleted in one commit.')
@AdditionalProperties(false)
export class DocumentsDeleteResponse {
    @Required()
    @Example('raw/2026-10-20-mistaken-note.md')
    public id: string;

    @Description('The commit the delete made.')
    @Required()
    public commit: string;
}
