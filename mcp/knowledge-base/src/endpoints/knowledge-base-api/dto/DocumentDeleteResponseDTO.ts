import { AdditionalProperties, Property } from '@tsed/schema';

/** `DELETE /documents` response: the document was deleted. */
@AdditionalProperties(false)
export class DocumentDeleteResponseDTO {
    @Property() public id: string;
    @Property() public commit: string;
}
