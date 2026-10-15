import { AdditionalProperties, Description, Example, Required } from '@tsed/schema';

@Description('Documents per area (the `area` metadata field).')
@AdditionalProperties(false)
export class AreaCount {
    @Required()
    @Example('raw')
    public area: string;

    @Required()
    public documents: number;
}
