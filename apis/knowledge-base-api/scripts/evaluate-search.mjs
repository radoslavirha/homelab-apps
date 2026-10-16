#!/usr/bin/env node
/**
 * Measures search quality against a running knowledge-base-api, for a set of weight blends.
 *
 *   KB_API_URL=http://localhost:4003 KB_API_TOKEN=… \
 *     node scripts/evaluate-search.mjs questions.json 0:1 0.25:1 0.5:1 1:1
 *
 * `questions.json` is `[{ "question": "…", "expected": ["<externalId>", …] }, …]` — kept with
 * the knowledge base it measures, not here. Each further argument is a `fullText:vector`
 * weight pair, sent as per-request weights. A hit is any expected document in the top 5;
 * MRR uses the rank of the first expected document (0 when none is in the top 5).
 *
 * Ranks count **documents**, as the original measurement did ("an expected file in the top 5"):
 * search returns sections, and a document split into several would otherwise take several of the
 * five places. Each document keeps the rank of its best section.
 */
import { readFileSync } from 'node:fs';

const [questionsPath, ...variants] = process.argv.slice(2);
const baseUrl = process.env.KB_API_URL ?? 'http://localhost:4003';
const token = process.env.KB_API_TOKEN;

if (!questionsPath || !token) {
    console.error('usage: KB_API_TOKEN=… node scripts/evaluate-search.mjs questions.json [fullText:vector …]');
    process.exit(2);
}

const questions = JSON.parse(readFileSync(questionsPath, 'utf-8'));
const blends = (variants.length > 0 ? variants : ['0:1']).map((variant) => {
    const [fullText, vector] = variant.split(':').map(Number);

    return { label: variant, fullText, vector };
});

const search = async (question, blend) => {
    const url = new URL('/search', baseUrl);

    url.search = new URLSearchParams({
        q: question,
        // Enough sections to fill five distinct documents.
        limit: '50',
        fullTextWeight: String(blend.fullText),
        vectorWeight: String(blend.vector)
    }).toString();

    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!response.ok) {
        throw new Error(`${response.status} for "${question}"`);
    }

    return response.json();
};

for (const blend of blends) {
    let hits = 0;
    let reciprocalRanks = 0;
    const modes = new Map();
    const misses = [];

    for (const { question, expected } of questions) {
        const body = await search(question, blend);
        const ids = [...new Set(body.results.map((result) => result.externalId))].slice(0, 5);
        const rank = ids.findIndex((id) => expected.includes(id)) + 1;

        modes.set(body.mode, (modes.get(body.mode) ?? 0) + 1);

        if (rank > 0) {
            hits += 1;
            reciprocalRanks += 1 / rank;
        } else {
            misses.push({ question, top: ids.slice(0, 3) });
        }
    }

    console.log(`fullText:vector ${blend.label}  top-5 ${hits}/${questions.length}  MRR ${(reciprocalRanks / questions.length).toFixed(2)}  modes ${JSON.stringify(Object.fromEntries(modes))}`);

    for (const miss of misses) {
        console.log(`  miss: ${miss.question}\n        got ${miss.top.join(', ')}`);
    }
}
