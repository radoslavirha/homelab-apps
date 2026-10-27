import { AdditionalProperties, Property } from '@tsed/schema';

/**
 * One entry of an error body's `errors`. The API's refusal of a write carries the document as
 * its source holds it now in the entry named `CURRENT`, with `content` and `version`.
 */
@AdditionalProperties(false)
export class ErrorDetailDTO {
    @Property() public name?: string;
    @Property() public message?: string;
    @Property() public content?: string;
    @Property() public version?: string;
}
