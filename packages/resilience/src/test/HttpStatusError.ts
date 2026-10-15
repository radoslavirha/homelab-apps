export class HttpStatusError extends Error {
    public constructor(public readonly status: number) {
        super(`HTTP ${status}`);
    }
}
