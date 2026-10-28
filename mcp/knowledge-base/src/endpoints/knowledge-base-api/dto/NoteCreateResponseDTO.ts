import { AdditionalProperties, Property } from '@tsed/schema';

/** `POST /notes` response: the note was committed. */
@AdditionalProperties(false)
export class NoteCreateResponseDTO {
    @Property() public id: string;
    /** For git, the blob SHA. */
    @Property() public version: string;
    @Property() public commit: string;
}
