import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { type MockInstance, vi } from 'vitest';
import { GitHubEndpoint } from '../endpoints/github/GitHubEndpoint.js';
import { OllamaEndpoint } from '../endpoints/ollama/OllamaEndpoint.js';
import { RunStart } from '../models/RunStart.enum.js';
import { Server } from '../Server.js';
import { IndexingLoopService } from '../services/IndexingLoopService.js';
import { FakeGitHubEndpoint } from './FakeGitHubEndpoint.js';
import { FakeOllamaEndpoint } from './FakeOllamaEndpoint.js';

export interface WritableServer {
    readonly request: SuperTest.Agent;
    readonly github: FakeGitHubEndpoint;
    /** `IndexingLoopService.trigger`, stubbed: a write's run is asserted, not run. */
    readonly trigger: MockInstance<IndexingLoopService['trigger']>;
}

/**
 * Boots the server on the real git source, with GitHub replaced at the endpoint boundary by
 * {@link FakeGitHubEndpoint} — so the adapter, its writer and the refusal handling all run.
 */
export const bootstrapWritable = async (): Promise<WritableServer> => {
    const github = new FakeGitHubEndpoint();

    await PlatformTest.bootstrap(Server, {
        imports: [{ token: OllamaEndpoint, use: new FakeOllamaEndpoint() }, { token: GitHubEndpoint, use: github }]
    })();

    const trigger = vi.spyOn(PlatformTest.get<IndexingLoopService>(IndexingLoopService), 'trigger').mockResolvedValue(RunStart.Started);

    return { request: SuperTest.agent(PlatformTest.callback()), github, trigger };
};
