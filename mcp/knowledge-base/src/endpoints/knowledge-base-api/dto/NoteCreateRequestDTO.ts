import { AdditionalProperties, CollectionOf, Enum, Property } from '@tsed/schema';
import { NoteTypeDTO } from './NoteTypeDTO.enum.js';

/** `POST /notes` body: a new `raw/` note, as fields; the API renders the file. */
@AdditionalProperties(false)
export class NoteCreateRequestDTO {
    @Property() public kb: string;
    @Property() public title: string;
    @Enum(NoteTypeDTO) public type: NoteTypeDTO;
    @Property() public context: string;
    @Property() public decisionOrFact: string;
    @CollectionOf(String) public alternativesRejected?: string[];
    @Property() public howToApply?: string;
    @CollectionOf(String) public links?: string[];
    @CollectionOf(String) public repos?: string[];
    /** `YYYY-MM-DD`. */
    @Property() public date?: string;
    /** The id of the note this one replaces. */
    @Property() public supersedes?: string;
}
