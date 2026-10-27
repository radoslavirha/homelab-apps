import { CommonUtils, DefaultsUtil, StringUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { BadRequest } from '@tsed/exceptions';
import type { NotesPostRequest } from '../models/NotesPostRequest.js';
import { NoteType } from '../models/NoteType.enum.js';
import { DocumentValidationService } from './DocumentValidationService.js';

/** A `raw/` note, rendered. */
export interface RenderedNote {
    readonly id: string;
    readonly title: string;
    readonly content: string;
}

/** Longest slug a title turns into; cut at a word boundary. */
const SLUG_MAX = 60;

/** A repository name, safe to write unquoted into a YAML flow list. */
const REPO_NAME = /^[a-z0-9][a-z0-9._-]*$/i;

/** A YAML plain scalar that needs no quoting: starts with a letter or digit, no `: ` or ` #`. */
const PLAIN_SCALAR = /^[A-Za-z0-9][\w.@+-]*$/;

/**
 * Renders a `raw/` note from its fields, in the knowledge base's note format, so the frontmatter
 * cannot be malformed or smuggled in through the text. `source` is always `chat` — the note came
 * through the API, not a session in a clone — and `author` names who it was written for.
 *
 * The id is `raw/<date>-<slug>.md`, the slug made from the title.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class NoteRenderService {
    public constructor(private readonly validation: DocumentValidationService) {}

    public render(request: NotesPostRequest, author: string): RenderedNote {
        const date = DefaultsUtil.string(request.date, new Date().toISOString().slice(0, 10));
        const title = request.title.trim();
        const repos = request.repos ?? [];
        const alternatives = (request.alternativesRejected ?? []).map((alternative) => alternative.trim()).filter((alternative) => StringUtils.isNotEmpty(alternative));
        const links = (request.links ?? []).map((link) => link.trim()).filter((link) => StringUtils.isNotEmpty(link));
        const problems: string[] = [];

        if (!this.validation.isCalendarDate(date)) {
            problems.push('date: must be a YYYY-MM-DD date');
        }

        if (request.type === NoteType.Decision && CommonUtils.isEmpty(alternatives)) {
            problems.push('a DECISION needs alternativesRejected: each option rejected, and why');
        }

        if (request.type !== NoteType.Decision && !CommonUtils.isEmpty(alternatives)) {
            problems.push('only a DECISION has alternativesRejected');
        }

        if (!repos.every((repo) => REPO_NAME.test(repo))) {
            problems.push('repos: each must be a repository name, e.g. homelab-apps');
        }

        if (CommonUtils.notUndefined(request.supersedes) && !this.validation.isNoteId(request.supersedes)) {
            problems.push('supersedes: must be a note id, raw/YYYY-MM-DD-<slug>.md');
        }

        if (links.some((link) => /[\r\n]/.test(link))) {
            problems.push('links: one line each');
        }

        const slug = NoteRenderService.slug(title);

        if (!StringUtils.isNotEmpty(slug)) {
            problems.push('title: needs letters or digits to name the file after');
        }

        if (!CommonUtils.isEmpty(problems)) {
            throw new BadRequest(`The note is not valid: ${problems.join('; ')}.`);
        }

        const frontmatter = [
            '---',
            `date: ${date}`,
            `type: ${request.type.toLowerCase()}`,
            `repos: [${repos.join(', ')}]`,
            'source: chat',
            ...(CommonUtils.notUndefined(request.supersedes) ? [`supersedes: ${request.supersedes}`] : []),
            `author: ${PLAIN_SCALAR.test(author) ? author : JSON.stringify(author)}`,
            '---'
        ];
        const sections = [
            section('Context', request.context),
            section(request.type === NoteType.Decision ? 'Decision' : 'Fact', request.decisionOrFact),
            ...(CommonUtils.isEmpty(alternatives) ? [] : [section('Alternatives rejected', list(alternatives))]),
            ...(StringUtils.isNotEmpty(request.howToApply) ? [section('How to apply', request.howToApply)] : []),
            ...(CommonUtils.isEmpty(links) ? [] : [section('Links', list(links))])
        ];

        return {
            id: `raw/${date}-${slug}.md`,
            title,
            content: `${frontmatter.join('\n')}\n\n# ${title}\n\n${sections.join('\n\n')}\n`
        };
    }

    /** Lower-case kebab-case of the title's letters and digits, accents dropped, at most {@link SLUG_MAX} characters. */
    public static slug(title: string): string {
        const slug = title
            .normalize('NFKD')
            .replace(/\p{M}/gu, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        if (slug.length <= SLUG_MAX) {
            return slug;
        }

        const cut = slug.slice(0, SLUG_MAX + 1);
        const boundary = cut.lastIndexOf('-');

        return (boundary > 0 ? cut.slice(0, boundary) : slug.slice(0, SLUG_MAX)).replace(/-+$/, '');
    }
}

/** `## Heading` and its text right below, as the knowledge base's notes are written. */
const section = (heading: string, text: string): string => `## ${heading}\n${text.trim()}`;

/** A markdown list; an item's further lines are indented under it. */
const list = (items: readonly string[]): string => items.map((item) => `- ${item.replace(/\r?\n/g, '\n  ')}`).join('\n');
