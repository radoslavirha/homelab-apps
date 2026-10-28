import { AdditionalProperties, CollectionOf, Property } from '@tsed/schema';
import { ErrorDetailDTO } from './ErrorDetailDTO.js';

/** The body of any error the API answers: Ts.ED's exception shape. */
@AdditionalProperties(false)
export class ErrorResponseDTO {
    @Property() public name?: string;
    @Property() public message?: string;
    @Property() public status?: number;
    @CollectionOf(ErrorDetailDTO) public errors?: ErrorDetailDTO[];
}
