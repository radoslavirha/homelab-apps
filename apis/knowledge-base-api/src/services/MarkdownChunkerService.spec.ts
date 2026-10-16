import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChunkingMode } from '../models/ChunkingMode.enum.js';
import { MarkdownChunkerService, type MarkdownChunkOptions } from './MarkdownChunkerService.js';

const options = (overrides: Partial<MarkdownChunkOptions> = {}): MarkdownChunkOptions => ({
    externalId: 'work/spec.md',
    title: 'Knowledge base index',
    mode: ChunkingMode.Sections,
    maxChars: 3000,
    overlapChars: 0,
    ...overrides
});

const SPEC = `# Knowledge base index

Turns the knowledge base into a searchable index.

## Scope

In and out.

## Decisions

### 1. Postgres + pgvector

Not SQLite.

### 2. A new, shared Postgres server

One server.

#### Details

Stay in the H3.
`;

describe('MarkdownChunkerService', () => {
    let chunker: MarkdownChunkerService;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        chunker = PlatformTest.get<MarkdownChunkerService>(MarkdownChunkerService);
    });
    afterEach(PlatformTest.reset);

    describe('sections', () => {
        it('cuts at H2 and H3, prefixes the heading path and drops the H1 title', () => {
            const chunks = chunker.chunk(SPEC, options());

            expect(chunks.map((chunk) => [chunk.heading, chunk.body])).toEqual([
                ['', 'Turns the knowledge base into a searchable index.'],
                ['Scope', 'In and out.'],
                ['Decisions › 1. Postgres + pgvector', 'Not SQLite.'],
                ['Decisions › 2. A new, shared Postgres server', 'One server.\n\n#### Details\n\nStay in the H3.']
            ]);
        });

        it('makes no chunk for an H2 that only introduces H3s', () => {
            const headings = chunker.chunk(SPEC, options()).map((chunk) => chunk.heading);

            expect(headings).not.toContain('Decisions');
        });

        it('numbers chunks in document order', () => {
            expect(chunker.chunk(SPEC, options()).map((chunk) => chunk.ord)).toEqual([0, 1, 2, 3]);
        });

        it('anchors each chunk with the GitHub slug of its own heading, and the preamble with the bare id', () => {
            expect(chunker.chunk(SPEC, options()).map((chunk) => chunk.anchor)).toEqual([
                'work/spec.md',
                'work/spec.md#scope',
                'work/spec.md#1-postgres--pgvector',
                'work/spec.md#2-a-new-shared-postgres-server'
            ]);
        });

        it('does not treat a heading inside a code fence as a heading', () => {
            const markdown = [
                '## Format',
                '',
                '```markdown',
                '## Context',
                'What prompted it.',
                '```',
                '',
                '~~~',
                '### Not a heading either',
                '~~~'
            ].join('\n');
            const chunks = chunker.chunk(markdown, options());

            expect(chunks).toHaveLength(1);
            expect(chunks[0].heading).toBe('Format');
            expect(chunks[0].body).toContain('## Context');
        });

        it('keeps a fence that is closed by a longer fence of the same character open until it closes', () => {
            const markdown = ['## A', '````', '```', '## inside', '````', '## B', 'b'].join('\n');

            expect(chunker.chunk(markdown, options()).map((chunk) => chunk.heading)).toEqual(['A', 'B']);
        });

        it('reduces link syntax in headings to its text', () => {
            const [chunk] = chunker.chunk('## See [the spec](https://example.test/x)\n\ntext', options());

            expect(chunk.heading).toBe('See the spec');
            expect(chunk.anchor).toBe('work/spec.md#see-the-spec');
        });
    });

    describe('splitting long sections', () => {
        const paragraph = (letter: string, length: number): string => letter.repeat(length);

        it('splits at paragraph boundaries and keeps the heading and anchor on every part', () => {
            const markdown = `## Long\n\n${paragraph('a', 1200)}\n\n${paragraph('b', 1200)}\n\n${paragraph('c', 1200)}`;
            const chunks = chunker.chunk(markdown, options({ maxChars: 2500 }));

            expect(chunks.map((chunk) => chunk.body.length)).toEqual([2402, 1200]);
            expect(chunks.every((chunk) => chunk.heading === 'Long' && chunk.anchor === 'work/spec.md#long')).toBe(true);
        });

        it('never splits inside a fenced code block at a blank line', () => {
            const code = ['```', 'line 1', '', 'line 2', '```'].join('\n');
            const markdown = `## Code\n\n${paragraph('a', 50)}\n\n${code}`;
            const chunks = chunker.chunk(markdown, options({ maxChars: 60 }));

            expect(chunks.map((chunk) => chunk.body)).toEqual([paragraph('a', 50), code]);
        });

        it('splits an oversized paragraph at lines', () => {
            const lines = Array.from({ length: 10 }, (_, i) => `line ${i} ${'x'.repeat(40)}`).join('\n');
            const chunks = chunker.chunk(`## Lines\n\n${lines}`, options({ maxChars: 200 }));

            expect(chunks.length).toBeGreaterThan(1);
            expect(chunks.every((chunk) => chunk.body.length <= 200)).toBe(true);
            expect(chunks.map((chunk) => chunk.body).join('\n')).toBe(lines);
        });

        it('repeats a table\'s header and separator rows on every piece of a split table', () => {
            const header = '| Component | Version |\n|---|---|';
            const rows = Array.from({ length: 30 }, (_, i) => `| component-${i} | ${i}.0.0 |`);
            const chunks = chunker.chunk(`## Stack\n\n${header}\n${rows.join('\n')}`, options({ maxChars: 300 }));

            expect(chunks.length).toBeGreaterThan(1);
            expect(chunks.every((chunk) => chunk.body.startsWith(header))).toBe(true);
            expect(chunks.flatMap((chunk) => chunk.body.split('\n').slice(2))).toEqual(rows);
        });

        it('repeats trailing paragraphs up to overlapChars at the start of the next part', () => {
            const markdown = `## O\n\n${paragraph('a', 100)}\n\n${paragraph('b', 100)}\n\n${paragraph('c', 100)}`;
            const chunks = chunker.chunk(markdown, options({ maxChars: 210, overlapChars: 100 }));

            expect(chunks.map((chunk) => chunk.body)).toEqual([
                `${paragraph('a', 100)}\n\n${paragraph('b', 100)}`,
                `${paragraph('b', 100)}\n\n${paragraph('c', 100)}`
            ]);
        });
    });

    describe('entries', () => {
        const HISTORY = `# homelab — docs history

Generated. Do not edit.

## 2026-10-14 · \`d81caee\` · feat(postgres): generate role passwords

> Role passwords are no longer seeded by hand.

### Not a boundary in entries mode

Files: \`docs/secrets.md\`

## 2026-10-13 · \`8c49715\` · refactor(agents): slim AGENTS.md

> AGENTS.md is rewritten.
`;

        it('makes one chunk per H2 entry, H3 included, never split', () => {
            const chunks = chunker.chunk(HISTORY, options({ externalId: 'mirror/homelab/_history.md', mode: ChunkingMode.Entries, maxChars: 50 }));

            expect(chunks.map((chunk) => chunk.heading)).toEqual([
                '',
                '2026-10-14 · `d81caee` · feat(postgres): generate role passwords',
                '2026-10-13 · `8c49715` · refactor(agents): slim AGENTS.md'
            ]);
            expect(chunks[1].body).toContain('### Not a boundary in entries mode');
        });

        it('anchors entries the way GitHub does — punctuation dropped, every space a hyphen', () => {
            const chunks = chunker.chunk(HISTORY, options({ externalId: 'mirror/homelab/_history.md', mode: ChunkingMode.Entries }));

            expect(chunks[1].anchor).toBe('mirror/homelab/_history.md#2026-10-14--d81caee--featpostgres-generate-role-passwords');
        });
    });

    describe('hash', () => {
        it('is stable for the same title, heading and body', () => {
            const first = chunker.chunk(SPEC, options());
            const second = chunker.chunk(SPEC, options());

            expect(first.map((chunk) => chunk.hash)).toEqual(second.map((chunk) => chunk.hash));
        });

        it('changes with the title, because a template embeds it', () => {
            const before = chunker.chunk(SPEC, options());
            const after = chunker.chunk(SPEC, options({ title: 'Renamed' }));

            expect(after[1].hash).not.toBe(before[1].hash);
        });

        it('changes with the heading even when the body is the same', () => {
            const [a] = chunker.chunk('## One\n\nsame', options());
            const [b] = chunker.chunk('## Two\n\nsame', options());

            expect(a.hash).not.toBe(b.hash);
        });
    });

    describe('extractTitle', () => {
        it('returns the first H1 outside a fence', () => {
            expect(chunker.extractTitle('```\n# not this\n```\n\n# Title [link](x)\n\n# Second')).toBe('Title link');
        });

        it('returns null when there is no H1', () => {
            expect(chunker.extractTitle('## Only H2')).toBeNull();
        });
    });

    describe('documentText', () => {
        it('puts the heading path above the body, or just the body', () => {
            expect(MarkdownChunkerService.documentText('A › B', 'body')).toBe('A › B\n\nbody');
            expect(MarkdownChunkerService.documentText('', 'body')).toBe('body');
        });
    });
});
