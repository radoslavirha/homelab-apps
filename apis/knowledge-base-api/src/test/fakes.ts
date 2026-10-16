import type { SourceDocument } from '../sources/SourceDocument.js';

/**
 * The stubbed embedder's vectors: 4 dimensions (as `config/test.json` declares), one per topic,
 * so a question about a topic lands nearest to the chunks about it — enough to prove the vector
 * leg ranks by meaning, without a model.
 */
const TOPICS: readonly RegExp[] = [/configmap|environment|env/gi, /traefik|port|probe/gi, /backup|longhorn|dump/gi];

export const fakeVector = (text: string): number[] => {
    const counts = TOPICS.map((topic) => (text.match(topic) ?? []).length);
    const vector = [...counts, 0.1];
    const length = Math.hypot(...vector);

    return vector.map((value) => value / length);
};

/** A source document; its url names the version, as a git permalink names the commit. */
export const sourceDocument = (externalId: string, content: string, extra: Partial<SourceDocument> = {}): SourceDocument => {
    const version = extra.version ?? 'c1';

    return {
        externalId,
        title: extra.title ?? externalId,
        date: null,
        url: `https://example.test/blob/${version}/${externalId}`,
        content,
        version,
        metadata: { area: externalId.split('/')[0] },
        ...extra
    };
};
