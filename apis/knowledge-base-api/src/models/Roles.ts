/**
 * Authentik roles this API checks. They are an external contract — the strings in the
 * Authentik blueprint — so they are constants, not an enum with upper-case values.
 */

/** Search, read documents, read status. Also the default `readers` role of a knowledge base. */
export const ROLE_READER = 'knowledge-base-api.reader';

/** Create, rewrite and delete documents. Inherits reader in Authentik, so its tokens carry both. */
export const ROLE_EDITOR = 'knowledge-base-api.editor';

/** Start an indexing run. */
export const ROLE_ADMIN = 'knowledge-base-api.admin';
