import { Description, MinLength, Required } from '@tsed/schema';

export class ReadInput {
    @Description('The document id (or a section anchor), as a search hit gave it.')
    @Required()
    @MinLength(1)
    public id: string;
}
