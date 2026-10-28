import { AdditionalProperties, Property } from '@tsed/schema';

/** `PUT /documents` response: the document was committed. */
@AdditionalProperties(false)
export class DocumentWriteResponseDTO {
    @Property() public id: string;
    /** For git, the blob SHA. */
    @Property() public version: string;
    @Property() public commit: string;
}
