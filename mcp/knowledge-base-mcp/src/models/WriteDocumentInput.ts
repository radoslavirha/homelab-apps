import { Description, MinLength, Property, Required } from '@tsed/schema';

export class WriteDocumentInput {
    @Description('`work/<YYYY-MM-DD>-<kebab-slug>/spec.md` or `…/plan.md`. A new folder is created.')
    @Required()
    @MinLength(1)
    public id: string;

    @Description('The whole markdown, frontmatter included (`status`, `repos`, `created`). Not a patch.')
    @Required()
    @MinLength(1)
    public content: string;

    @Description('Required to rewrite: the version your change was made to — from `read`, your last write of it, or a refusal\'s `current`. Leave it out to create.')
    @Property()
    public version?: string;

    @Description('Why, in a line or a paragraph. The commit message\'s body.')
    @Property()
    public message?: string;
}
