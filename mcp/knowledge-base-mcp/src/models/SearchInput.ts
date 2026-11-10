import { Description, Integer, Max, MaxLength, Min, MinLength, Property, Required } from '@tsed/schema';

export class SearchInput {
    @Description('What you want to know, in natural language — a question works better than keywords.')
    @Required()
    @MinLength(1)
    @MaxLength(1000)
    public query: string;

    @Description('Metadata filter, `key:value` pairs separated by commas: a repeated key means "or", different keys "and". E.g. `area:raw` (decision notes), `area:work` (specs and plans), `area:mirror` (repository docs), `repos:homelab`, `type:decision`.')
    @Property()
    public filter?: string;

    @Description('How many sections to return. Leave it out for the endpoint\'s default; a large value is capped by the endpoint.')
    @Integer()
    @Min(1)
    @Max(50)
    public limit?: number;
}
