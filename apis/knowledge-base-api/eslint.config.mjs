import { config } from 'typescript-eslint';
import Config from '@radoslavirha/config-eslint';
import PreferUtils from '@radoslavirha/utils/eslint';

export default config(...Config, ...PreferUtils, {
    // A provider in a test is resolved through DI (`PlatformTest.get`), never constructed — see
    // .apm/instructions/tsed-testing.instructions.md. Test doubles (`Fake…`) and `AbortController` are exempt.
    // PreferUtils ignores spec files, so this is the only no-restricted-syntax entry they get.
    files: ['**/*.spec.ts'],
    rules: {
        'no-restricted-syntax': [
            'error',
            {
                selector: 'NewExpression[callee.name=/^(?!Fake|Abort).*(Service|Mapper|Handler|Repository|Endpoint|Controller|Provider|Parser|Factory)$/]',
                message: 'Resolve providers through DI in tests: PlatformTest.get(Provider), collaborators via vi.spyOn.'
            }
        ]
    }
});
