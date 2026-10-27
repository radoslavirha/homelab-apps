import { CommonUtils, ObjectUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { parse } from 'yaml';

export interface Frontmatter {
    /** The parsed header, or `{}` when there is none or it does not parse. */
    readonly data: Record<string, unknown>;
    /** The document without the header. */
    readonly body: string;
    /** Why the header was ignored, when one was present but unusable. */
    readonly error?: string;
}

/** `---` on the first line, the YAML, then `---` (or `...`) on a line of its own. */
const FRONTMATTER = /^﻿?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

/**
 * Splits a YAML header off a markdown document.
 *
 * Parsed with the YAML 1.2 core schema, so `date: 2026-10-14` stays the string it was written
 * as — the 1.1 schema would turn it into a `Date` and the metadata would stop being plain JSON.
 *
 * A broken header never fails a document: it is reported in `error`, the document is indexed
 * without metadata, and the body is kept without the header so the YAML is not embedded.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class FrontmatterService {
    public parse(content: string): Frontmatter {
        const match = FRONTMATTER.exec(content);

        if (CommonUtils.isNull(match)) {
            return { data: {}, body: content };
        }

        const body = content.slice(match[0].length);

        try {
            const data: unknown = parse(match[1] ?? '', { schema: 'core' });

            if (CommonUtils.isNil(data)) {
                return { data: {}, body };
            }

            if (!ObjectUtils.isPlainObject(data)) {
                return { data: {}, body, error: 'Frontmatter is not a mapping.' };
            }

            return { data, body };
        } catch (error) {
            return { data: {}, body, error: error instanceof Error ? error.message : String(error) };
        }
    }
}
