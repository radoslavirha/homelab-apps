import { AdditionalProperties, Nullable, Property } from '@tsed/schema';

/** `GET /documents` response: one whole document. */
@AdditionalProperties(false)
export class DocumentResponseDTO {
    @Property() public kb: string;
    @Property() public externalId: string;
    @Nullable(String) public title: string | null;
    @Nullable(String) public date: string | null;
    @Nullable(String) public url: string | null;
    @Property() public version: string;
    @Property(Object) public metadata: Record<string, unknown>;
    @Property() public content: string;
}
