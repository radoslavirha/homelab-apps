import { CommonUtils } from '@radoslavirha/utils';
import { PlatformTest } from '@tsed/platform-http/testing';
import { ChunkDTO } from '../storage/postgres/dto/ChunkDTO.js';
import { DocumentDTO } from '../storage/postgres/dto/DocumentDTO.js';
import { DocumentRepository } from '../storage/postgres/DocumentRepository.js';
import { PostgresService } from '../storage/postgres/PostgresService.js';

/** A `documents` row for the `dev` knowledge base (the one `config/test.json` declares). */
export const documentDTO = (externalId: string, overrides: Partial<DocumentDTO> = {}): DocumentDTO =>
    CommonUtils.buildModelStrict(DocumentDTO, {
        kb: 'dev',
        externalId,
        title: externalId,
        date: null,
        url: null,
        content: `content of ${externalId}`,
        version: 'c1',
        metadata: { area: externalId.split('/')[0] },
        ...overrides
    });

export const chunkDTO = (ord: number, heading: string, body: string, hash = `${heading}:${body}`): ChunkDTO =>
    CommonUtils.buildModelStrict(ChunkDTO, { ord, heading, anchor: `x#${ord}`, body, hash });

/** Writes a document with its chunks through the repository and returns the chunk ids by heading. */
export const seedDocument = async (document: DocumentDTO, chunks: ChunkDTO[]): Promise<Record<string, string>> => {
    await PlatformTest.get<DocumentRepository>(DocumentRepository).upsert(document, 'english', chunks);

    const { rows } = await PlatformTest.get<PostgresService>(PostgresService).query<{ heading: string; id: string }>(
        'SELECT c.heading, c.id FROM chunks c JOIN documents d ON d.id = c.document_id WHERE d.kb = $1 AND d.external_id = $2',
        [document.kb, document.externalId]
    );

    return Object.fromEntries(rows.map((row) => [row.heading, row.id]));
};

/** Empties the index, keeping the knowledge base rows the migrator wrote. */
export const truncateIndex = async (): Promise<void> => {
    const postgres = PlatformTest.get<PostgresService>(PostgresService);

    await postgres.query('TRUNCATE documents CASCADE');
    await postgres.query(
        `UPDATE knowledge_bases SET cursor = NULL, last_run_started_at = NULL, last_run_finished_at = NULL,
         last_run_outcome = NULL, last_run_error = NULL, last_success_at = NULL`
    );
};
