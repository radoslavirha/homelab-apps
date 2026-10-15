import { DefaultsUtil, StringUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { BadRequest } from '@tsed/exceptions';
import type { MetadataFilter } from '../models/MetadataFilter.js';

const KEY = /^[A-Za-z0-9_.-]+$/;

/**
 * Parses the `filter` query parameter: `key:value` pairs separated by commas, e.g.
 * `area:work,repos:homelab`. A repeated key lists alternatives (`type:decision,type:gotcha`);
 * different keys must all match. A value may contain `:` (`supersedes:raw/x.md`), not `,`.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class MetadataFilterService {
    public parse(raw: string | undefined): MetadataFilter {
        const filter = new Map<string, string[]>();

        for (const part of DefaultsUtil.string(raw, '').split(',')) {
            const pair = part.trim();

            if (!StringUtils.isNotEmpty(pair)) {
                continue;
            }

            const separator = pair.indexOf(':');
            const key = pair.slice(0, separator).trim();
            const value = pair.slice(separator + 1).trim();

            if (separator <= 0 || !StringUtils.isNotEmpty(value) || !KEY.test(key)) {
                throw new BadRequest(`Invalid filter "${pair}"; expected key:value.`);
            }

            filter.set(key, [...new Set([...(filter.get(key) ?? []), value])]);
        }

        return filter;
    }
}
