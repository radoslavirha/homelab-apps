import { type BaseLogger, Logger } from '@radoslavirha/tsed-logger';
import { CommonUtils, StringUtils } from '@radoslavirha/utils';
import { Inject, ProviderScope, Scope, Service } from '@tsed/di';
import type { GitHubRepositoryDTO } from '../../endpoints/github/dto/GitHubRepositoryDTO.js';
import { ChunkingMode } from '../../models/ChunkingMode.enum.js';
import { FrontmatterService } from '../../services/FrontmatterService.js';
import { MarkdownChunkerService } from '../../services/MarkdownChunkerService.js';
import type { SourceDocument } from '../SourceDocument.js';

/** File name of a generated docs history: one H2 per commit, one chunk per H2. */
const HISTORY_FILE = '_history.md';

/** Area whose second path segment names the repository a document was mirrored from. */
const MIRROR_AREA = 'mirror';

/**
 * Turns one file of a git knowledge base into a {@link SourceDocument}.
 *
 * - `metadata` is the frontmatter, plus `area` — the first path segment (`raw`, `work`,
 *   `mirror`) — and, under `mirror/<repo>/`, `repos: [<repo>]`, so a `repos:` filter finds a
 *   repo's mirrored docs the same way it finds notes that name the repo.
 * - `title` is the first H1, else a `title` field, else the file name.
 * - `date` is the frontmatter `date` (notes) or `created` (specs), when it is a real date.
 * - `version` is the file's blob SHA: it changes exactly when the file does, and it is what
 *   GitHub's contents API compares on a write, so a version from `GET /documents` can be sent
 *   straight back to rewrite or delete the file.
 * - `url` points at the file at the indexed commit, so it shows what was indexed.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class GitDocumentParser {
    private readonly log: BaseLogger;

    public constructor(
        private readonly frontmatter: FrontmatterService,
        private readonly chunker: MarkdownChunkerService,
        @Inject(Logger) logger: Logger
    ) {
        this.log = logger.child('GIT_SOURCE');
    }

    public parse(path: string, text: string, blob: string, commit: string, repository: GitHubRepositoryDTO): SourceDocument {
        const { data, body, error } = this.frontmatter.parse(text);

        if (CommonUtils.notUndefined(error)) {
            this.log.warn('Frontmatter ignored.', { event: 'GIT_SOURCE_FRONTMATTER', path, error });
        }

        const segments = path.split('/');
        const metadata: Record<string, unknown> = { ...data };

        if (segments.length > 1) {
            metadata.area = segments[0];
        }

        if (segments[0] === MIRROR_AREA && segments.length > 2) {
            metadata.repos = [segments[1]];
        }

        return {
            externalId: path,
            title: this.chunker.extractTitle(body) ?? stringField(data.title) ?? baseName(path),
            date: dateField(data.date) ?? dateField(data.created),
            url: `${repository.htmlUrl}/blob/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`,
            content: text,
            version: blob,
            metadata,
            ...(segments[segments.length - 1] === HISTORY_FILE ? { chunking: ChunkingMode.Entries } : {})
        };
    }
}

const stringField = (value: unknown): string | null => {
    // Typed loosely so the guard can narrow it; a non-string fails the guard at runtime.
    const text = value as string | null | undefined;

    return StringUtils.isNotEmpty(text) ? text.trim() : null;
};

/** `YYYY-MM-DD` that is a real calendar date — `2026-02-30` is not, and would fail the insert. */
const dateField = (value: unknown): string | null => {
    if (!StringUtils.isString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }

    const parsed = new Date(`${value}T00:00:00Z`);

    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value) ? value : null;
};

const baseName = (path: string): string => path.split('/').pop()!.replace(/\.[^.]+$/, '');
