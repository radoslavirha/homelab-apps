import { PlatformTest } from '@tsed/platform-http/testing';
import SuperTest from 'supertest';
import { OllamaEndpoint } from '../endpoints/ollama/OllamaEndpoint.js';
import { Server } from '../Server.js';
import { IndexingLoopService } from '../services/IndexingLoopService.js';
import { SourceAdapterFactory } from '../sources/SourceAdapterFactory.js';
import { PostgresService } from '../storage/postgres/PostgresService.js';
import { CORPUS } from './corpus.js';
import { FakeOllamaEndpoint } from './FakeOllamaEndpoint.js';
import { FakeSourceAdapterFactory } from './FakeSourceAdapterFactory.js';

export interface IndexedServer {
    readonly request: SuperTest.Agent;
    readonly ollama: FakeOllamaEndpoint;
    readonly sources: FakeSourceAdapterFactory;
}

/** Boots the server on the stubbed embedder and source, with {@link CORPUS} indexed as commit `c1`. */
export const bootstrapIndexed = async (): Promise<IndexedServer> => {
    const ollama = new FakeOllamaEndpoint();
    const sources = new FakeSourceAdapterFactory();

    sources.adapter.next = { upserts: CORPUS, deletes: [], cursor: 'c1', complete: true };

    await PlatformTest.bootstrap(Server, {
        imports: [{ token: OllamaEndpoint, use: ollama }, { token: SourceAdapterFactory, use: sources }]
    })();
    await PlatformTest.get<PostgresService>(PostgresService).query('TRUNCATE documents CASCADE');
    await PlatformTest.get<IndexingLoopService>(IndexingLoopService).run({ knowledgeBases: ['development'], full: true, manual: true });

    return { request: SuperTest.agent(PlatformTest.callback()), ollama, sources };
};
