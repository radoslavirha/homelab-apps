import { describe, expect, it } from 'vitest';
import { FenceTracker } from './FenceTracker.js';

// FenceTracker is per-pass state, not a DI provider: one instance per document is the point.
describe('FenceTracker', () => {
    const feed = (lines: string[]): boolean[] => {
        const fences = new FenceTracker();

        return lines.map((line) => fences.consume(line));
    };

    it('treats the fence lines and everything between them as inside', () => {
        expect(feed(['text', '```ts', '## not a heading', '```', 'after'])).toEqual([false, true, true, true, false]);
    });

    it('closes only on the same character, at least as long, with nothing after it', () => {
        expect(feed(['````', '```', '~~~~', '```` trailing', '````', 'out'])).toEqual([true, true, true, true, true, false]);
    });

    it('reports whether it is inside a fence right now', () => {
        const fences = new FenceTracker();

        fences.consume('~~~');
        expect(fences.inside).toBe(true);
        fences.consume('~~~');
        expect(fences.inside).toBe(false);
    });
});
