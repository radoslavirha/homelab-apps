import { CommonUtils } from '@radoslavirha/utils';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotesPostRequest } from '../models/NotesPostRequest.js';
import { NoteType } from '../models/NoteType.enum.js';
import { NoteRenderService } from './NoteRenderService.js';

const request = (overrides: Partial<NotesPostRequest> = {}): NotesPostRequest => CommonUtils.buildModelPartial(NotesPostRequest, {
    kb: 'development',
    title: 'Ollama keeps one model loaded',
    type: NoteType.Gotcha,
    context: 'Embedding evicted the chat model.',
    decisionOrFact: 'Only one model fits in memory.',
    ...overrides
});

describe('NoteRenderService', () => {
    let notes: NoteRenderService;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        notes = PlatformTest.get<NoteRenderService>(NoteRenderService);
    });
    afterEach(PlatformTest.reset);
    afterEach(() => vi.useRealTimers());

    it('renders a fact with only the sections it has, dated today when no date is given', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-26T23:30:00Z'));

        expect(notes.render(request(), 'akadmin')).toEqual({
            id: 'raw/2026-10-26-ollama-keeps-one-model-loaded.md',
            title: 'Ollama keeps one model loaded',
            content: '---\ndate: 2026-10-26\ntype: gotcha\nrepos: []\nsource: chat\nauthor: akadmin\n---\n\n'
                + '# Ollama keeps one model loaded\n\n## Context\nEmbedding evicted the chat model.\n\n## Fact\nOnly one model fits in memory.\n'
        });
    });

    it('quotes an author YAML would otherwise misread, and indents an item\'s further lines', () => {
        const { content } = notes.render(request({
            type: NoteType.Decision,
            alternativesRejected: ['Two models\nwould not fit.'],
            supersedes: 'raw/2026-09-06-old.md',
            date: '2026-10-20'
        }), '@someone');

        expect(content).toContain('supersedes: raw/2026-09-06-old.md\nauthor: "@someone"\n---');
        expect(content).toContain('## Decision\nOnly one model fits in memory.\n\n## Alternatives rejected\n- Two models\n  would not fit.\n');
    });

    it.each([
        [{ date: '2026-02-30' }, 'date: must be a YYYY-MM-DD date'],
        [{ type: NoteType.Decision }, 'a DECISION needs alternativesRejected'],
        [{ alternativesRejected: ['An option.'] }, 'only a DECISION has alternativesRejected'],
        [{ repos: ['home lab'] }, 'repos: each must be a repository name'],
        [{ supersedes: 'work/2026-09-06-old/spec.md' }, 'supersedes: must be a note id'],
        [{ links: ['one\ntwo'] }, 'links: one line each'],
        [{ title: '— ¿? —' }, 'title: needs letters or digits']
    ])('refuses %j', (overrides, message) => {
        expect(() => notes.render(request(overrides), 'akadmin')).toThrow(message);
    });

    describe('slug', () => {
        it('is the title in lower-case kebab-case, accents dropped', () => {
            expect(NoteRenderService.slug('Žluťoučký kůň: `GET /x` → 404!')).toBe('zlutoucky-kun-get-x-404');
        });

        it('stops at a word boundary within 60 characters, or cuts a single long word', () => {
            const slug = NoteRenderService.slug('One-off work in an API image runs through dist cli js and a small dispatcher');

            expect(slug).toBe('one-off-work-in-an-api-image-runs-through-dist-cli-js-and-a');
            expect(NoteRenderService.slug('x'.repeat(70))).toBe('x'.repeat(60));
        });
    });
});
