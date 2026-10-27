import { ArrayUtils, CommonUtils, StringUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { BadRequest } from '@tsed/exceptions';
import { ON_BEHALF_OF_HEADER, ON_BEHALF_OF_PATTERN } from '../models/OnBehalfOf.js';
import { FrontmatterService } from './FrontmatterService.js';
import { MarkdownChunkerService } from './MarkdownChunkerService.js';
import { SecretScanService } from './SecretScanService.js';

/** `raw/YYYY-MM-DD-<kebab-slug>.md`; group 1 is the date. */
const RAW_ID = /^raw\/(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

/** `work/YYYY-MM-DD-<kebab-slug>/spec.md` or `plan.md`; group 1 is the date. */
const WORK_ID = /^work\/(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\/(?:spec|plan)\.md$/;

const WORK_STATUSES: readonly string[] = ['draft', 'approved', 'in-progress', 'done', 'abandoned', 'reference'];

const MIRROR_REFUSED = 'mirror/ is generated from the repositories\' docs and never written here: change the doc in its repository.';

const RAW_REWRITE_REFUSED = 'raw/ notes are append-only: to change what one says, create a new note (POST /notes) with supersedes pointing at it.';

/**
 * The knowledge base's rules for what may be written where, and in which shape — the same rules
 * its own note checker applies, enforced here so an agent cannot get them wrong:
 *
 * | Area | Create | Rewrite | Delete |
 * |---|---|---|---|
 * | `raw/` | as fields, `POST /notes` | never — append-only | yes |
 * | `work/` | yes | yes | yes |
 * | `mirror/`, anything else | never | never | never |
 *
 * Every refusal is a `400` that says what to change. Secrets are refused, not flagged.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class DocumentValidationService {
    public constructor(
        private readonly frontmatter: FrontmatterService,
        private readonly chunker: MarkdownChunkerService,
        private readonly secrets: SecretScanService
    ) {}

    /**
     * The username a write is for, from the `On-Behalf-Of` header. Checked here, not by the
     * header's schema: Ts.ED does not validate header parameters.
     */
    public onBehalfOf(value: string | undefined): string {
        if (!StringUtils.isNotEmpty(value) || !ON_BEHALF_OF_PATTERN.test(value)) {
            throw new BadRequest(`${ON_BEHALF_OF_HEADER} must name the user the write is for: a username of letters, digits and _ . @ + -.`);
        }

        return value;
    }

    /** A whole `work/` document, valid as a spec or a plan. Returns its title (the first H1). */
    public workDocument(id: string, content: string): string {
        this.writablePath(id);

        const problems: string[] = [];
        const { data, body, error } = this.frontmatter.parse(content);

        if (!/^﻿?---[ \t]*\r?\n/.test(content)) {
            problems.push('it must start with --- frontmatter (status, repos, created)');
        } else if (CommonUtils.notUndefined(error)) {
            problems.push(`its frontmatter does not parse: ${error}`);
        } else {
            if (!StringUtils.isString(data.status) || !WORK_STATUSES.includes(data.status)) {
                problems.push(`status: must be one of ${WORK_STATUSES.join(', ')}`);
            }

            if (!ArrayUtils.isArray(data.repos) || !data.repos.every((repo) => StringUtils.isNotEmpty(repo))) {
                problems.push('repos: must be a list of repository names, e.g. [homelab, homelab-apps], or []');
            }

            if (!this.isCalendarDate(data.created)) {
                problems.push('created: must be a YYYY-MM-DD date');
            }
        }

        const title = this.chunker.extractTitle(body);

        if (CommonUtils.isNull(title)) {
            problems.push('it needs a "# " title line');
        }

        if (!CommonUtils.isEmpty(problems)) {
            throw new BadRequest(`${id} is not a valid spec or plan: ${problems.join('; ')}.`);
        }

        this.refuseSecrets(content, id);

        return title!;
    }

    /** Where `PUT /documents` may write: `work/` specs and plans, nothing else. */
    public writablePath(id: string): void {
        if (id.startsWith('mirror/')) {
            throw new BadRequest(MIRROR_REFUSED);
        }

        if (id.startsWith('raw/')) {
            throw new BadRequest(RAW_REWRITE_REFUSED);
        }

        const match = WORK_ID.exec(id);

        if (CommonUtils.isNull(match) || !this.isCalendarDate(match[1])) {
            throw new BadRequest('A spec or plan id must be work/YYYY-MM-DD-<kebab-slug>/spec.md or plan.md, with a real date.');
        }
    }

    /** What `DELETE /documents` may delete: a `raw/` note or a `work/` document. */
    public deletablePath(id: string): void {
        if (id.startsWith('mirror/')) {
            throw new BadRequest(MIRROR_REFUSED);
        }

        if (!this.isNoteId(id) && !WORK_ID.test(id)) {
            throw new BadRequest('Only a raw/ note (raw/YYYY-MM-DD-<slug>.md) or a work/ spec or plan can be deleted.');
        }
    }

    /** A `raw/` note's id, with a real date — what `supersedes` must name. */
    public isNoteId(id: string): boolean {
        const match = RAW_ID.exec(id);

        return CommonUtils.notNull(match) && this.isCalendarDate(match[1]);
    }

    /** `YYYY-MM-DD` that is a real calendar date — `2026-02-30` is not. */
    public isCalendarDate(value: unknown): value is string {
        if (!StringUtils.isString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return false;
        }

        const parsed = new Date(`${value}T00:00:00Z`);

        return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
    }

    /** Refuses text that looks like it holds a secret, saying what and where — never the value. */
    public refuseSecrets(text: string, what: string): void {
        const finding = this.secrets.scan(text);

        if (CommonUtils.notNull(finding)) {
            throw new BadRequest(
                `Refused: ${what} looks like it holds ${finding.kind} (line ${finding.line}). The knowledge base is written as if it were public — remove it.`
            );
        }
    }
}
