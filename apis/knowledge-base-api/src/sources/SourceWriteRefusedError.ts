/** The source refused a write: the version was not the one it holds, or a create found the document. */
export class SourceWriteRefusedError extends Error {
    public constructor(id: string, options?: ErrorOptions) {
        super(`The source refused the write of ${id}.`, options);
        this.name = 'SourceWriteRefusedError';
    }
}
