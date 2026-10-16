import { createHash } from 'node:crypto';
import { CommonUtils, StringUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { FenceTracker } from '../markdown/FenceTracker.js';
import { GithubSlugger } from '../markdown/GithubSlugger.js';
import { ChunkingMode } from '../models/ChunkingMode.enum.js';

export interface MarkdownChunk {
    /** Position in the document. */
    readonly ord: number;
    /** Heading path, e.g. `Decisions › 3. Run it with …`. Empty for text before the first H2. */
    readonly heading: string;
    /** `<externalId>#<github-slug>` — what search returns and a reader can open. */
    readonly anchor: string;
    readonly body: string;
    /**
     * sha256 of the title, heading path and body — everything a model template can see — so a
     * chunk is re-embedded exactly when its embedded text would change, for any model.
     */
    readonly hash: string;
}

export interface MarkdownChunkOptions {
    readonly externalId: string;
    /** Document title; part of the hash, and what a model template's `{title}` receives. */
    readonly title: string | null;
    readonly mode: ChunkingMode;
    readonly maxChars: number;
    readonly overlapChars: number;
}

interface Section {
    readonly path: readonly string[];
    readonly slug: string | null;
    readonly lines: string[];
}

export const HEADING_SEPARATOR = ' › ';

const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;

/**
 * Cuts markdown into chunks for embedding and full-text search.
 *
 * - **H1 is the title**, not a chunk boundary: the first H1 is dropped from the body and becomes
 *   the document title. Text before the first H2 is a chunk with an empty heading.
 * - **H2 and H3 start a chunk** (`SECTIONS`); H4–H6 stay inside their section. An H2 directly
 *   followed by an H3 produces no empty chunk — the H2 lives on in the H3's heading path.
 * - **A long section is split at paragraph boundaries** (blank lines outside code fences), every
 *   part keeping the section's heading and anchor. A paragraph longer than the limit is split at
 *   line boundaries, and a line longer than that at the limit itself.
 * - **`ENTRIES`** cuts at H2 only and never splits: one chunk per entry of a log.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class MarkdownChunkerService {
    /**
     * A chunk as it reads on its own: heading path, a blank line, the body. What a model
     * template's `{text}` receives; the title is passed separately as `{title}`.
     */
    public static documentText(heading: string, body: string): string {
        return StringUtils.isNotEmpty(heading) ? `${heading}\n\n${body}` : body;
    }

    /** The hash of a chunk: title, heading path and body, independent of any model's template. */
    public static hash(title: string | null, heading: string, body: string): string {
        return createHash('sha256')
            .update(`${title ?? ''}\u0000${MarkdownChunkerService.documentText(heading, body)}`)
            .digest('hex');
    }

    /** The first H1 outside a code fence, or `null`. */
    public extractTitle(markdown: string): string | null {
        const fences = new FenceTracker();

        for (const line of markdown.split(/\r?\n/)) {
            if (fences.consume(line)) {
                continue;
            }

            const heading = HEADING.exec(line);

            if (CommonUtils.notNull(heading) && heading[1].length === 1) {
                const text = MarkdownChunkerService.cleanHeading(heading[2] ?? '');

                if (StringUtils.isNotEmpty(text)) {
                    return text;
                }
            }
        }

        return null;
    }

    public chunk(markdown: string, options: MarkdownChunkOptions): MarkdownChunk[] {
        const chunks: MarkdownChunk[] = [];

        for (const section of this.sections(markdown, options.mode)) {
            const body = section.lines.join('\n').replace(/^(?:[ \t]*\n)+/, '').trimEnd();

            if (!StringUtils.isNotEmpty(body)) {
                continue;
            }

            const heading = section.path.join(HEADING_SEPARATOR);
            const anchor = CommonUtils.isNull(section.slug) ? options.externalId : `${options.externalId}#${section.slug}`;
            const parts = options.mode === ChunkingMode.Entries
                ? [body]
                : this.split(body, options.maxChars, options.overlapChars);

            for (const part of parts) {
                chunks.push({
                    ord: chunks.length,
                    heading,
                    anchor,
                    body: part,
                    hash: MarkdownChunkerService.hash(options.title, heading, part)
                });
            }
        }

        return chunks;
    }

    private sections(markdown: string, mode: ChunkingMode): Section[] {
        const slugger = new GithubSlugger();
        const fences = new FenceTracker();
        let current: Section = { path: [], slug: null, lines: [] };
        const sections: Section[] = [current];
        let h2: string | null = null;
        let titleSeen = false;

        for (const line of markdown.split(/\r?\n/)) {
            if (fences.consume(line)) {
                current.lines.push(line);
                continue;
            }

            const heading = HEADING.exec(line);
            const text = heading ? MarkdownChunkerService.cleanHeading(heading[2] ?? '') : '';

            if (CommonUtils.isNull(heading) || !StringUtils.isNotEmpty(text)) {
                current.lines.push(line);
                continue;
            }

            const level = heading[1].length;
            // Every heading takes a slug, title included, so de-duplication counts like GitHub's.
            const slug = slugger.slug(text);

            if (level === 1 && !titleSeen && sections.length === 1) {
                titleSeen = true;
                continue;
            }

            if (level <= 2) {
                h2 = text;
                current = { path: [text], slug, lines: [] };
                sections.push(current);
            } else if (level === 3 && mode === ChunkingMode.Sections) {
                current = { path: CommonUtils.isNull(h2) ? [text] : [h2, text], slug, lines: [] };
                sections.push(current);
            } else {
                current.lines.push(line);
            }
        }

        return sections;
    }

    private split(body: string, maxChars: number, overlapChars: number): string[] {
        if (body.length <= maxChars) {
            return [body];
        }

        const paragraphs = this.paragraphs(body)
            .flatMap((paragraph) => paragraph.length > maxChars ? this.hardSplit(paragraph, maxChars) : [paragraph]);
        const parts: string[] = [];
        let current: string[] = [];

        for (const paragraph of paragraphs) {
            if (!CommonUtils.isEmpty(current) && joinedLength([...current, paragraph]) > maxChars) {
                parts.push(current.join('\n\n'));

                const overlap = tail(current, overlapChars);

                current = joinedLength([...overlap, paragraph]) > maxChars ? [] : overlap;
            }

            current.push(paragraph);
        }

        if (!CommonUtils.isEmpty(current)) {
            parts.push(current.join('\n\n'));
        }

        return parts;
    }

    /** Blank-line separated blocks; a fenced code block is never broken up. */
    private paragraphs(body: string): string[] {
        const fences = new FenceTracker();
        const paragraphs: string[] = [];
        let buffer: string[] = [];

        for (const line of body.split('\n')) {
            if (!fences.inside && !StringUtils.isNotEmpty(line)) {
                if (!CommonUtils.isEmpty(buffer)) {
                    paragraphs.push(buffer.join('\n'));
                    buffer = [];
                }
                continue;
            }

            fences.consume(line);
            buffer.push(line);
        }

        if (!CommonUtils.isEmpty(buffer)) {
            paragraphs.push(buffer.join('\n'));
        }

        return paragraphs;
    }

    /**
     * Splits one oversized paragraph at line boundaries. A markdown table repeats its header and
     * separator rows on every piece, so each piece still says what its columns are — without it
     * a piece of the architecture stack table is a list of cells with no meaning.
     */
    private hardSplit(paragraph: string, maxChars: number): string[] {
        const lines = paragraph.split('\n');
        const header = isTable(lines) && lines[0].length + lines[1].length + 2 < maxChars / 2 ? lines.slice(0, 2) : [];
        const headerText = header.join('\n');
        const pieces: string[] = [];
        let buffer = headerText;
        let hasRows = false;

        for (const line of lines.slice(header.length)) {
            for (let start = 0; start < Math.max(line.length, 1); start += maxChars) {
                const piece = line.slice(start, start + maxChars);

                if (hasRows && buffer.length + 1 + piece.length > maxChars) {
                    pieces.push(buffer);
                    buffer = headerText;
                    hasRows = false;
                }

                buffer = CommonUtils.isEmpty(buffer) ? piece : `${buffer}\n${piece}`;
                hasRows = true;
            }
        }

        if (hasRows) {
            pieces.push(buffer);
        }

        return pieces;
    }

    /** Heading text as rendered: link and image syntax reduced to their text. */
    private static cleanHeading(text: string): string {
        return text
            .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
            .trim();
    }
}

/** A header row, then a separator row such as `|---|:--:|`. */
const isTable = (lines: readonly string[]): boolean =>
    lines.length >= 2 && /^\s*\|/.test(lines[0]) && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(lines[1]);

const joinedLength = (paragraphs: readonly string[]): number =>
    paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0) + Math.max(0, paragraphs.length - 1) * 2;

/** The trailing paragraphs of `paragraphs` that fit in `budget` characters. */
const tail = (paragraphs: readonly string[], budget: number): string[] => {
    const kept: string[] = [];

    for (let i = paragraphs.length - 1; i >= 0; i--) {
        if (joinedLength([paragraphs[i], ...kept]) > budget) {
            break;
        }
        kept.unshift(paragraphs[i]);
    }

    return kept;
};
