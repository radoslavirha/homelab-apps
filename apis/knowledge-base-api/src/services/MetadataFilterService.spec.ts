import { BadRequest } from '@tsed/exceptions';
import { PlatformTest } from '@tsed/platform-http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MetadataFilterService } from './MetadataFilterService.js';


describe('MetadataFilterService', () => {
    let filters: MetadataFilterService;

    beforeEach(PlatformTest.create);
    beforeEach(() => {
        filters = PlatformTest.get<MetadataFilterService>(MetadataFilterService);
    });
    afterEach(PlatformTest.reset);

    it('parses key:value pairs', () => {
        expect(filters.parse('area:work,repos:homelab')).toEqual(new Map([['area', ['work']], ['repos', ['homelab']]]));
    });

    it('collects a repeated key as alternatives', () => {
        expect(filters.parse('type:decision, type:gotcha,type:decision')).toEqual(new Map([['type', ['decision', 'gotcha']]]));
    });

    it('keeps a colon inside the value', () => {
        expect(filters.parse('supersedes:raw/a:b.md').get('supersedes')).toEqual(['raw/a:b.md']);
    });

    it('returns an empty filter for nothing', () => {
        expect(filters.parse(undefined).size).toBe(0);
        expect(filters.parse(' , ').size).toBe(0);
    });

    it.each(['area', ':work', 'area:', 'bad key:x'])('rejects %j', (raw) => {
        expect(() => filters.parse(raw)).toThrow(BadRequest);
    });
});
