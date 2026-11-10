import { ConfigDocs } from '@radoslavirha/tsed-configuration';
import { describe, expect, it } from 'vitest';
import { ConfigSchema } from './ConfigModel.js';

describe('CONFIGURATION.md', () => {
    it('Should match the configuration schema', async () => {
        expect.assertions(1);
        await expect(ConfigDocs.render(ConfigSchema, { title: 'qr-manager-api' }))
            .toMatchFileSnapshot('../../../CONFIGURATION.md');
    });
});
