/**
 * The write routes' caller is a service (the MCP server, with its own token), not the person it
 * writes for. It names that person in this header; the commit's `On-behalf-of:` trailer and a
 * note's `author:` carry it. A username only — no newline can reach the commit message.
 */
export const ON_BEHALF_OF_HEADER = 'On-Behalf-Of';

/** An Authentik username: letters, digits and `_ . @ + -`, up to 150 characters. */
export const ON_BEHALF_OF_PATTERN = /^[\w.@+-]{1,150}$/;
