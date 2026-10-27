/**
 * How a knowledge base's documents are cut into chunks. One chunker per value.
 */
export enum ContentType {
    /** Markdown with optional YAML frontmatter, chunked at H2/H3. */
    Markdown = 'MARKDOWN'
}
