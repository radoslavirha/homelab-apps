import { createHash } from 'node:crypto';
import { Serializer } from '@radoslavirha/tsed-common';
import { CommonUtils } from '@radoslavirha/utils';
import { RequestError } from 'octokit';
import type { GitHubContentDeleteRequestDTO } from '../endpoints/github/dto/GitHubContentDeleteRequestDTO.js';
import { GitHubContentCommitDTO } from '../endpoints/github/dto/GitHubContentCommitDTO.js';
import { GitHubContentDTO } from '../endpoints/github/dto/GitHubContentDTO.js';
import type { GitHubContentPutRequestDTO } from '../endpoints/github/dto/GitHubContentPutRequestDTO.js';
import { GitHubRepositoryDTO } from '../endpoints/github/dto/GitHubRepositoryDTO.js';

/** One commit the fake made: what the write routes asked GitHub for. */
export interface FakeCommit {
    readonly sha: string;
    readonly path: string;
    readonly message: string;
    readonly branch: string;
    /** The file after the commit; `null` for a delete. */
    readonly content: string | null;
}

const refusal = (status: number, message: string): RequestError =>
    new RequestError(message, status, { request: { method: 'PUT', url: 'https://api.github.test/contents', headers: {} } });

/**
 * Stands in for `GitHubEndpoint` in the write integration tests (`imports: [{ token, use }]`): one
 * branch of files in memory, checked the way GitHub's contents API checks a write — a `sha` that
 * is not the file's blob is refused, and so is a create of a file that exists.
 *
 * Blob SHAs are git's own (`sha1("blob <size>\0<content>")`), so a version from one write is the
 * one the next must send. `interfere` plays a write from elsewhere moving the branch at that
 * moment: the next contents writes are refused although the `sha` matches.
 */
export class FakeGitHubEndpoint {
    public readonly repository = Serializer.deserialize({
        name: 'kb',
        owner: { login: 'someone' },
        default_branch: 'main',
        html_url: 'https://github.test/someone/kb'
    }, GitHubRepositoryDTO);

    public readonly files = new Map<string, string>();
    public readonly commits: FakeCommit[] = [];
    /** Contents writes still to refuse as a branch race, whatever their `sha`. */
    public interfere = 0;
    /** Contents writes in flight right now, and the most there ever were. */
    public inFlight = 0;
    public maxInFlight = 0;

    public static blobSha(content: string): string {
        const bytes = Buffer.from(content, 'utf-8');

        return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    }

    /** The version a test holds for a file it seeded. */
    public seed(path: string, content: string): string {
        this.files.set(path, content);

        return FakeGitHubEndpoint.blobSha(content);
    }

    public listRepositories(): Promise<GitHubRepositoryDTO[]> {
        return Promise.resolve([this.repository]);
    }

    public getContent(_repo: GitHubRepositoryDTO, path: string): Promise<GitHubContentDTO> {
        const content = this.files.get(path);

        if (CommonUtils.isUndefined(content)) {
            return Promise.reject(refusal(404, 'Not Found'));
        }

        return Promise.resolve(Serializer.deserialize({
            type: 'file',
            path,
            sha: FakeGitHubEndpoint.blobSha(content),
            content: Buffer.from(content, 'utf-8').toString('base64'),
            encoding: 'base64'
        }, GitHubContentDTO));
    }

    public putContent(_repo: GitHubRepositoryDTO, path: string, request: GitHubContentPutRequestDTO): Promise<GitHubContentCommitDTO> {
        return this.commit(() => {
            const existing = this.files.get(path);

            if (CommonUtils.isUndefined(request.sha) && CommonUtils.notUndefined(existing)) {
                throw refusal(422, 'Invalid request. "sha" wasn\'t supplied.');
            }

            if (CommonUtils.notUndefined(request.sha)) {
                if (CommonUtils.isUndefined(existing)) {
                    throw refusal(404, 'Not Found');
                }

                if (FakeGitHubEndpoint.blobSha(existing) !== request.sha) {
                    throw refusal(409, `${path} does not match ${request.sha}`);
                }
            }

            const content = Buffer.from(request.content, 'base64').toString('utf-8');

            this.files.set(path, content);

            return { path, message: request.message, branch: request.branch, content };
        });
    }

    public deleteContent(_repo: GitHubRepositoryDTO, path: string, request: GitHubContentDeleteRequestDTO): Promise<GitHubContentCommitDTO> {
        return this.commit(() => {
            const existing = this.files.get(path);

            if (CommonUtils.isUndefined(existing)) {
                throw refusal(404, 'Not Found');
            }

            if (FakeGitHubEndpoint.blobSha(existing) !== request.sha) {
                throw refusal(409, `${path} does not match ${request.sha}`);
            }

            this.files.delete(path);

            return { path, message: request.message, branch: request.branch, content: null };
        });
    }

    /** Runs a write a tick later, so two writes sent together would overlap if nothing queued them. */
    private async commit(apply: () => Omit<FakeCommit, 'sha'>): Promise<GitHubContentCommitDTO> {
        this.inFlight++;
        this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);

        try {
            await new Promise((resolve) => setTimeout(resolve, 5));

            if (this.interfere > 0) {
                this.interfere--;
                throw refusal(409, 'is at a different commit');
            }

            const change = apply();
            const sha = createHash('sha1').update(`commit ${this.commits.length + 1}`).digest('hex');

            this.commits.push({ sha, ...change });

            return Serializer.deserialize({
                content: CommonUtils.isNull(change.content) ? null : { path: change.path, sha: FakeGitHubEndpoint.blobSha(change.content) },
                commit: { sha }
            }, GitHubContentCommitDTO);
        } finally {
            this.inFlight--;
        }
    }
}
