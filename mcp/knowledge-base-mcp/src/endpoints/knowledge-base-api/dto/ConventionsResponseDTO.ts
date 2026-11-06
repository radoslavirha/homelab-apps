import { AdditionalProperties, Nullable, Property } from '@tsed/schema';

/** `GET /conventions` response: the knowledge base's conventions file, all null when it names none. */
@AdditionalProperties(false)
export class ConventionsResponseDTO {
    @Property() public kb: string;
    @Nullable(String) public path: string | null;
    @Nullable(String) public markdown: string | null;
    @Nullable(String) public version: string | null;
}
