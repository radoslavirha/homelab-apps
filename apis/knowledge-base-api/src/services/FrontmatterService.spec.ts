import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FrontmatterService } from './FrontmatterService.js';


describe('FrontmatterService', () => {
    let frontmatter: FrontmatterService;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        frontmatter = PlatformTest.get<FrontmatterService>(FrontmatterService);
    });
    afterEach(PlatformTest.reset);

    it('splits the YAML header off and parses it', () => {
        const parsed = frontmatter.parse([
            '---',
            'date: 2026-10-13                      # when the decision was established',
            'type: decision',
            'repos: [homelab, iot-esphome]',
            'supersedes: raw/2026-01-08-old.md',
            '---',
            '',
            '# Title',
            ''
        ].join('\n'));

        expect(parsed.data).toEqual({
            date: '2026-10-13',
            type: 'decision',
            repos: ['homelab', 'iot-esphome'],
            supersedes: 'raw/2026-01-08-old.md'
        });
        expect(parsed.body).toBe('\n# Title\n');
        expect(parsed.error).toBeUndefined();
    });

    it('keeps dates as the strings they were written as, so metadata stays plain JSON', () => {
        const { data } = frontmatter.parse('---\ncreated: 2026-10-14\n---\nbody');

        expect(data.created).toBe('2026-10-14');
        expect(typeof data.created).toBe('string');
    });

    it('returns the whole document as body when there is no header', () => {
        expect(frontmatter.parse('# Just markdown\n---\nnot: a header')).toEqual({ data: {}, body: '# Just markdown\n---\nnot: a header' });
    });

    it('accepts CRLF line endings and a ... terminator', () => {
        expect(frontmatter.parse('---\r\nstatus: done\r\n...\r\nbody').data).toEqual({ status: 'done' });
    });

    it('accepts an empty header', () => {
        expect(frontmatter.parse('---\n---\nbody')).toEqual({ data: {}, body: 'body' });
    });

    it('drops a header that does not parse, keeps the body without it, and says why', () => {
        const parsed = frontmatter.parse('---\nrepos: [unclosed\n---\nbody');

        expect(parsed.data).toEqual({});
        expect(parsed.body).toBe('body');
        expect(parsed.error).toBeDefined();
    });

    it('drops a header that is not a mapping', () => {
        const parsed = frontmatter.parse('---\n- a\n- b\n---\nbody');

        expect(parsed.data).toEqual({});
        expect(parsed.error).toBe('Frontmatter is not a mapping.');
    });
});
