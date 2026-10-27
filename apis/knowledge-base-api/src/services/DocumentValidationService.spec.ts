import { PlatformTest } from '@tsed/platform-http/testing';
import { BadRequest } from '@tsed/exceptions';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocumentValidationService } from './DocumentValidationService.js';

const SPEC = '---\nstatus: in-progress\nrepos: [homelab, homelab-apps]\ncreated: 2026-10-20\n---\n\n```\n# not a title\n```\n\n# The title\n';

describe('DocumentValidationService', () => {
    let validation: DocumentValidationService;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        validation = PlatformTest.get<DocumentValidationService>(DocumentValidationService);
    });
    afterEach(PlatformTest.reset);

    describe('workDocument', () => {
        it('accepts a spec or a plan and answers its title, the first H1 outside a fence', () => {
            expect(validation.workDocument('work/2026-10-20-kb-write-tool/spec.md', SPEC)).toBe('The title');
            expect(validation.workDocument('work/2026-10-20-kb-write-tool/plan.md', SPEC.replace('[homelab, homelab-apps]', '[]'))).toBe('The title');
        });

        it('accepts a block list of repos and a byte-order mark', () => {
            expect(validation.workDocument('work/2026-10-20-x/spec.md', `﻿${SPEC.replace('[homelab, homelab-apps]', '\n  - homelab')}`)).toBe('The title');
        });

        it('names every problem at once', () => {
            expect(() => validation.workDocument('work/2026-10-20-x/spec.md', '---\nstatus: wip\nrepos: [ ""]\n---\ntext\n')).toThrow(
                'work/2026-10-20-x/spec.md is not a valid spec or plan: status: must be one of draft, approved, in-progress, done, abandoned, reference; '
                + 'repos: must be a list of repository names, e.g. [homelab, homelab-apps], or []; created: must be a YYYY-MM-DD date; it needs a "# " title line.'
            );
        });

        it('refuses a secret in the document', () => {
            expect(() => validation.workDocument('work/2026-10-20-x/spec.md', `${SPEC}\npassword: hunter2hunter2\n`)).toThrow(/holds a secret with its value \(line 13\)/);
        });
    });

    describe('writablePath', () => {
        it.each([
            ['mirror/homelab/docs/a.md', 'mirror/ is generated'],
            ['raw/2026-10-20-note.md', 'raw/ notes are append-only'],
            ['README.md', 'A spec or plan id must be'],
            ['work/2026-10-20-Upper/spec.md', 'A spec or plan id must be'],
            ['work/2026-13-01-x/spec.md', 'with a real date'],
            ['work/2026-10-20-x/sub/spec.md', 'A spec or plan id must be']
        ])('refuses %s', (id, message) => {
            expect(() => validation.writablePath(id)).toThrow(BadRequest);
            expect(() => validation.writablePath(id)).toThrow(message);
        });
    });

    describe('deletablePath', () => {
        it('allows a note and a work/ document', () => {
            expect(() => validation.deletablePath('raw/2026-10-20-note.md')).not.toThrow();
            expect(() => validation.deletablePath('work/2026-10-20-x/plan.md')).not.toThrow();
        });

        it.each([
            ['mirror/homelab/docs/a.md', 'mirror/ is generated'],
            ['raw/note.md', 'Only a raw/ note'],
            ['work/2026-10-20-x/notes.md', 'Only a raw/ note']
        ])('refuses %s', (id, message) => {
            expect(() => validation.deletablePath(id)).toThrow(message);
        });
    });

    describe('isNoteId', () => {
        it('is a raw/ note named after a real date', () => {
            expect(validation.isNoteId('raw/2026-09-06-old-note.md')).toBe(true);
            expect(validation.isNoteId('raw/2026-02-30-old.md')).toBe(false);
            expect(validation.isNoteId('work/2026-09-06-old/spec.md')).toBe(false);
        });
    });

    describe('isCalendarDate', () => {
        it('is YYYY-MM-DD on a day that exists', () => {
            expect(validation.isCalendarDate('2024-02-29')).toBe(true);
            expect(validation.isCalendarDate('2026-02-29')).toBe(false);
            expect(validation.isCalendarDate('2026-1-01')).toBe(false);
            expect(validation.isCalendarDate(20261020)).toBe(false);
        });
    });

    describe('onBehalfOf', () => {
        it('answers a username', () => {
            expect(validation.onBehalfOf('first.last@example.test')).toBe('first.last@example.test');
        });

        it.each([undefined, '', 'two words', 'line\nbreak', 'x'.repeat(151)])('refuses %j', (value) => {
            expect(() => validation.onBehalfOf(value)).toThrow(/On-Behalf-Of must name the user/);
        });
    });

    describe('refuseSecrets', () => {
        it('says what looked like a secret, and where, but not the value', () => {
            expect(() => validation.refuseSecrets('a\npassword: hunter2hunter2', 'the reason')).toThrow(
                'Refused: the reason looks like it holds a secret with its value (line 2). The knowledge base is written as if it were public — remove it.'
            );
            expect(() => validation.refuseSecrets('Merged into another spec.', 'the reason')).not.toThrow();
        });
    });
});
