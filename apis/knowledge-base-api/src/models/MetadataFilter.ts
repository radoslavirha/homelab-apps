/**
 * Filters on `documents.metadata`: key → accepted values. Values of one key are alternatives
 * ("or"); different keys must all match ("and"). A value matches a scalar field equal to it or
 * an array field containing it, so `repos:homelab` matches `repos: [homelab, homelab-apps]`.
 */
export type MetadataFilter = ReadonlyMap<string, readonly string[]>;
