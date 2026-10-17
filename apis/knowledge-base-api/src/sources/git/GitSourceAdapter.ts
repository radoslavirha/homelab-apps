import type { BaseLogger } from '@radoslavirha/tsed-logger';
import { CommonUtils, StringUtils } from '@radoslavirha/utils';
import { type GitHubEndpoint, isGitHubNotFound } from '../../endpoints/github/GitHubEndpoint.js';
import type { GitHubBlobDTO } from '../../endpoints/github/dto/GitHubBlobDTO.js';
import type { GitHubCompareDTO } from '../../endpoints/github/dto/GitHubCompareDTO.js';
import { GitHubCompareStatusDTO } from '../../endpoints/github/dto/GitHubCompareStatusDTO.enum.js';
import { GitHubFileStatusDTO } from '../../endpoints/github/dto/GitHubFileStatusDTO.enum.js';
import type { GitHubRepositoryDTO } from '../../endpoints/github/dto/GitHubRepositoryDTO.js';
import { GitHubTreeEntryTypeDTO } from '../../endpoints/github/dto/GitHubTreeEntryTypeDTO.enum.js';
import type { GitKnowledgeBaseConfig } from '../../models/config/KnowledgeBaseConfig.js';
import type { SourceAdapter } from '../SourceAdapter.js';
import type { SourceChanges } from '../SourceChanges.js';
import type { SourceDocument } from '../SourceDocument.js';
import type { GitDocumentParser } from './GitDocumentParser.js';
import type { GitHubRepositoryService } from './GitHubRepositoryService.js';

/** GitHub lists at most this many files for a whole comparison; reaching it means "maybe more". */
export const GITHUB_COMPARE_FILE_LIMIT = 300;

/** A file to read: its path and the SHA of its blob. */
interface BlobRef {
    readonly path: string;
    readonly sha: string;
}

/**
 * A git knowledge base read through the GitHub API — no clone, no `git` binary in the image.
 *
 * The cursor is the last indexed commit. A run compares it with the branch tip and fetches only
 * the files that changed. It falls back to listing the whole tree — and reports the result as
 * `complete`, so anything else stored is deleted — when there is no cursor yet, when the cursor
 * commit is gone (a force-push), when history diverged, or when the comparison may have been
 * cut off at GitHub's 300-file limit.
 *
 * Not a DI provider: one instance per knowledge base, built by `SourceAdapterFactory`.
 */
export class GitSourceAdapter implements SourceAdapter {
    public constructor(
        private readonly kb: GitKnowledgeBaseConfig,
        private readonly repositories: GitHubRepositoryService,
        private readonly github: GitHubEndpoint,
        private readonly parser: GitDocumentParser,
        private readonly concurrency: number,
        private readonly log: BaseLogger
    ) {}

    public async changes(cursor: string | null, signal?: AbortSignal): Promise<SourceChanges> {
        try {
            return await this.read(cursor, signal);
        } catch (error) {
            // The installation may have changed (key rotated, App moved): find it again next run.
            this.repositories.forget();
            throw error;
        }
    }

    private async read(cursor: string | null, signal?: AbortSignal): Promise<SourceChanges> {
        const repository = await this.repositories.repository();
        const branch = await this.github.getBranch(repository, this.kb.git.branch ?? repository.defaultBranch, signal);
        const head = branch.commit.sha;

        if (cursor === head) {
            return { upserts: [], deletes: [], cursor: head, complete: false };
        }

        if (CommonUtils.notNull(cursor)) {
            const diff = await this.diff(repository, cursor, head, signal);

            if (CommonUtils.notNull(diff)) {
                return {
                    upserts: await this.fetch(repository, head, diff.changed, signal),
                    deletes: diff.deleted,
                    cursor: head,
                    complete: false
                };
            }
        }

        const tree = await this.github.getTree(repository, head, signal);

        if (tree.truncated) {
            throw new Error('GitHub truncated the tree listing; the repository is too large to list in one call.');
        }

        const blobs = tree.tree
            .filter((entry) => entry.type === GitHubTreeEntryTypeDTO.Blob && this.included(entry.path))
            .map((entry) => ({ path: entry.path, sha: entry.sha }));

        return { upserts: await this.fetch(repository, head, blobs, signal), deletes: [], cursor: head, complete: true };
    }

    /** Changed and deleted paths from `base` to `head`, or `null` when a full listing is needed. */
    private async diff(
        repository: GitHubRepositoryDTO,
        base: string,
        head: string,
        signal?: AbortSignal
    ): Promise<{ changed: BlobRef[]; deleted: string[] } | null> {
        let comparison: GitHubCompareDTO;

        try {
            comparison = await this.github.compare(repository, base, head, signal);
        } catch (error) {
            if (isGitHubNotFound(error)) {
                this.log.warn('Indexed commit no longer exists; listing the whole tree.', { event: 'GIT_SOURCE_FULL', base, head });

                return null;
            }

            throw error;
        }

        if (comparison.status !== GitHubCompareStatusDTO.Ahead && comparison.status !== GitHubCompareStatusDTO.Identical) {
            this.log.warn('Branch history diverged from the indexed commit; listing the whole tree.', {
                event: 'GIT_SOURCE_FULL',
                status: comparison.status
            });

            return null;
        }

        if (comparison.files.length >= GITHUB_COMPARE_FILE_LIMIT) {
            this.log.info('Comparison may be truncated; listing the whole tree.', { event: 'GIT_SOURCE_FULL' });

            return null;
        }

        const changed: BlobRef[] = [];
        const deleted: string[] = [];

        for (const file of comparison.files) {
            if (file.status === GitHubFileStatusDTO.Unchanged) {
                continue;
            }

            if (file.status === GitHubFileStatusDTO.Removed) {
                deleted.push(file.filename);
                continue;
            }

            if (file.status === GitHubFileStatusDTO.Renamed && CommonUtils.notUndefined(file.previousFilename)) {
                deleted.push(file.previousFilename);
            }

            // A file without a blob (a submodule pointer) has nothing to read.
            if (StringUtils.isNotEmpty(file.sha)) {
                changed.push({ path: file.filename, sha: file.sha });
            }
        }

        return {
            changed: changed.filter((blob) => this.included(blob.path)),
            deleted: deleted.filter((path) => this.included(path))
        };
    }

    /** Fetches blobs a few at a time and parses each into a document. An abort stops every worker. */
    private async fetch(
        repository: GitHubRepositoryDTO,
        commit: string,
        blobs: readonly BlobRef[],
        signal?: AbortSignal
    ): Promise<SourceDocument[]> {
        const documents: SourceDocument[] = new Array(blobs.length);
        let next = 0;

        const worker = async (): Promise<void> => {
            while (next < blobs.length) {
                signal?.throwIfAborted();

                const index = next++;
                const blob = blobs[index];
                const text = GitSourceAdapter.text(await this.github.getBlob(repository, blob.sha, signal));

                documents[index] = this.parser.parse(blob.path, text, commit, repository);
            }
        };

        await Promise.all(Array.from({ length: Math.min(this.concurrency, blobs.length) }, worker));

        return documents;
    }

    private included(path: string): boolean {
        const { include, extensions } = this.kb.git;

        return include.some((prefix) => path.startsWith(prefix)) && extensions.some((extension) => path.endsWith(extension));
    }

    /** A blob's content as UTF-8 text. GitHub sends it base64-encoded. */
    private static text(blob: GitHubBlobDTO): string {
        return Buffer.from(blob.content, blob.encoding === 'base64' ? 'base64' : 'utf-8').toString('utf-8');
    }
}
