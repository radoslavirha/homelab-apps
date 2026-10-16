import { CommonUtils } from '@radoslavirha/utils';

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

/**
 * Tracks fenced code blocks line by line. A `## Context` inside a fenced example is text, not a
 * heading — the knowledge base's own README shows its note format that way, and cutting there
 * would split the example in half.
 */
export class FenceTracker {
    private fence: { char: string; length: number } | null = null;

    public get inside(): boolean {
        return CommonUtils.notNull(this.fence);
    }

    /** Feeds one line; true when it opened, closed or sits inside a fence. */
    public consume(line: string): boolean {
        if (CommonUtils.notNull(this.fence)) {
            const close = FENCE_CLOSE.exec(line);

            if (CommonUtils.notNull(close) && close[1][0] === this.fence.char && close[1].length >= this.fence.length) {
                this.fence = null;
            }

            return true;
        }

        const open = FENCE_OPEN.exec(line);

        if (CommonUtils.notNull(open)) {
            this.fence = { char: open[1][0], length: open[1].length };

            return true;
        }

        return false;
    }
}
