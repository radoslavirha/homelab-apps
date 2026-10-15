/**
 * GitHub's heading anchors (the `github-slugger` algorithm): lower-case, drop everything but
 * letters, marks, digits, connector punctuation, spaces and hyphens, turn each space into a
 * hyphen, then de-duplicate with `-1`, `-2`, … across the whole document.
 */
export class GithubSlugger {
    private readonly occurrences = new Map<string, number>();

    public static slugify(text: string): string {
        return text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-');
    }

    public slug(text: string): string {
        const original = GithubSlugger.slugify(text);
        let result = original;

        while (this.occurrences.has(result)) {
            const next = (this.occurrences.get(original) ?? 0) + 1;

            this.occurrences.set(original, next);
            result = `${original}-${next}`;
        }

        this.occurrences.set(result, 0);

        return result;
    }
}
