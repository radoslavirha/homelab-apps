import { AdditionalProperties, Property } from '@tsed/schema';

/** `GET /conventions` query parameters. */
@AdditionalProperties(false)
export class ConventionsQueryDTO {
    @Property() public kb: string;
}
