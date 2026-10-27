import { AdditionalProperties, Property } from '@tsed/schema';

/** `PUT /documents` body: a whole `work/` spec or plan to create or rewrite. */
@AdditionalProperties(false)
export class DocumentWriteRequestDTO {
    @Property() public kb: string;
    @Property() public id: string;
    /** The whole markdown, frontmatter included. */
    @Property() public content: string;
    /** Absent to create. */
    @Property() public version?: string;
    /** The commit message's body. */
    @Property() public message?: string;
}
