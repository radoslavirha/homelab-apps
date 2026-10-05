import { describe, expect, it } from 'vitest';
import { Store } from '@tsed/core';
import { Get, Post, SpecTypes, getSpec } from '@tsed/schema';
import { Controller } from '@tsed/di';
import { AuthGuard, decodeMethods } from './AuthGuard.js';
import { TEST_METHOD } from '@radoslavirha/auth';
import { SwaggerSecurityScheme } from '@radoslavirha/tsed-swagger';
import { Anonymous, Authenticate, BEARER_JWT_SCHEME, CurrentPrincipal, RequireRoles } from './decorators.js';
import type { AuthGuardOptions } from './AuthGuard.js';
import type { Principal } from '@radoslavirha/auth';

@Controller('/things')
@Authenticate(TEST_METHOD)
class ProtectedController {
    @Get('/')
    list(@CurrentPrincipal() principal: Principal | undefined): string {
        return principal?.subject ?? 'anonymous';
    }

    @Get('/public')
    @Anonymous()
    open(): string {
        return 'open';
    }
}

const guardOptionsOn = (property: string): AuthGuardOptions | undefined =>
    Store.fromMethod(ProtectedController, property).get(AuthGuard) as AuthGuardOptions | undefined;

describe('@Authenticate on a controller', () => {
    it('reaches every method, so a route added later is protected by default', () => {
        // The arrangement that matters: protection is inherited, not opted into.
        // Per-method application is where the next route is one forgotten
        // decorator away from being public.
        expect(guardOptionsOn('list')).toBeDefined();
        expect(guardOptionsOn('open')).toBeDefined();
    });

    it('leaves a plain method with no anonymous flag, so the guard protects it', () => {
        expect(guardOptionsOn('list')?.anonymous).toBeUndefined();
    });
});

describe('@Anonymous', () => {
    it('marks only the endpoint it sits on', () => {
        expect(guardOptionsOn('open')?.anonymous).toBe(true);
        expect(guardOptionsOn('list')?.anonymous).toBeUndefined();
    });
});

describe('@CurrentPrincipal', () => {
    it('applies without throwing, and the controller still exposes its route', () => {
        // The decorator's real behaviour is the pipe's, which has its own spec;
        // what matters here is that composing it onto a parameter is valid.
        expect(Store.fromMethod(ProtectedController, 'list')).toBeDefined();
    });
});

describe('@Authenticate(method)', () => {
    @Controller('/devices')
    @Authenticate(TEST_METHOD)
    class ExplicitController {
        @Get('/')
        list(): string {
            return '';
        }
    }

    it('records the method the route asked for', () => {
        const options = Store.fromMethod(ExplicitController, 'list').get(AuthGuard) as { methods?: string };

        expect(decodeMethods(options.methods)).toEqual([TEST_METHOD]);
    });

    it('is required, so no route can be guarded without saying by what', () => {
        // A compile-time guarantee, restated at runtime: the guard refuses an
        // endpoint whose store carries no method rather than letting it through.
        expect(decodeMethods(guardOptionsOn('list')?.methods)).toEqual([TEST_METHOD]);
    });

    it('records several methods in the order the route listed them', () => {
        // Order is policy: the chain tries them in this sequence, so it must
        // survive the round trip through the store.
        @Controller('/multi')
        @Authenticate(TEST_METHOD, 'API_KEY')
        class MultiController {
            @Get('/') list(): string {
                return ''; 
            }
        }

        const options = Store.fromMethod(MultiController, 'list').get(AuthGuard) as { methods?: string };

        expect(decodeMethods(options.methods)).toEqual([TEST_METHOD, 'API_KEY']);
    });

    it('lets a method-level decorator REPLACE the class-level one, not add to it', () => {
        // The behaviour `interactive-map-feeder-api` depends on to keep a
        // person's token out of the device route. It works only because the
        // encoded value is a string: Ts.ED concatenates arrays on merge, so a
        // plain `string[]` here would have made this route admit both.
        @Controller('/mixed')
        @Authenticate(TEST_METHOD)
        class MixedController {
            @Get('/inherited') inherited(): string {
                return ''; 
            }

            @Get('/swapped')
            @Authenticate('DEVICE')
            swapped(): string {
                return ''; 
            }
        }

        const read = (key: string) =>
            decodeMethods((Store.fromMethod(MixedController, key).get(AuthGuard) as { methods?: string }).methods);

        expect(read('inherited')).toEqual([TEST_METHOD]);
        expect(read('swapped')).toEqual(['DEVICE']);
    });
});

@Controller('/qr-codes')
@Authenticate(TEST_METHOD)
class DocumentedController {
    @Get('/')
    list(@CurrentPrincipal() principal: Principal | undefined): string {
        return principal?.subject ?? '';
    }

    @Post('/')
    create(): string {
        return 'created';
    }

    @Get('/:slug')
    @Anonymous()
    resolve(): string {
        return 'redirect';
    }
}

/** Method-level use: supported, though the class-level form is the safe default. */
@Controller('/mixed')
class PartlyProtectedController {
    @Get('/open')
    open(): string {
        return 'open';
    }

    @Get('/closed')
    @Authenticate(TEST_METHOD)
    closed(): string {
        return 'closed';
    }
}

@Controller('/roled')
@Authenticate(TEST_METHOD)
@RequireRoles('qr-manager.reader')
class RoledController {
    @Get('/')
    read(): string {
        return 'read';
    }

    @Get('/admin-only')
    @RequireRoles('qr-manager.admin')
    adminOnly(): string {
        return 'admin';
    }

    @Get('/either')
    @RequireRoles('qr-manager.admin', 'qr-manager.editor')
    either(): string {
        return 'either';
    }
}

const specOf = (token: Parameters<typeof getSpec>[0]) =>
    getSpec(token, { specType: SpecTypes.OPENAPI }) as {
        paths: Record<string, Record<string, { security?: unknown[]; responses?: Record<string, { description?: string }> }>>;
    };

const spec = getSpec(DocumentedController, { specType: SpecTypes.OPENAPI }) as {
    paths: Record<string, Record<string, { security?: unknown[]; responses?: Record<string, unknown> }>>;
};

const operation = (path: string, method: string) => spec.paths[path]?.[method];

describe('generated OpenAPI', () => {
    it('marks a protected operation with the bearer scheme', () => {
        expect(operation('/qr-codes', 'get')?.security).toEqual([{ [BEARER_JWT_SCHEME]: [] }]);
    });

    it('marks every operation of the controller, not just the first', () => {
        // The whole reason @Authenticate goes on the class: a route added later
        // is documented as protected without anyone remembering to say so.
        expect(operation('/qr-codes', 'post')?.security).toEqual([{ [BEARER_JWT_SCHEME]: [] }]);
    });

    it('documents the two responses the guard can actually produce', () => {
        const responses = operation('/qr-codes', 'get')?.responses ?? {};

        expect(Object.keys(responses)).toEqual(expect.arrayContaining(['401', '503']));
    });

    it('overrides an anonymous operation with an empty requirement', () => {
        // OpenAPI's own opt-out: `security: []` on the operation. Swagger UI
        // stops offering the padlock on a route that ignores it.
        expect(operation('/qr-codes/{slug}', 'get')?.security).toEqual([]);
    });

    it('does not claim an anonymous operation can answer 401', () => {
        const responses = operation('/qr-codes/{slug}', 'get')?.responses ?? {};

        expect(Object.keys(responses)).not.toContain('401');
        expect(Object.keys(responses)).not.toContain('503');
    });

    it('emits nothing but standard OpenAPI — no vendor extensions', () => {
        // The requirement was "native, no new inventions in the swagger json".
        // An `x-` key anywhere would break a generator that does not know it.
        const asText = JSON.stringify(spec);
        expect(asText).not.toMatch(/"x-/);
    });

    it('references the very scheme the swagger package defines', () => {
        // Not a matching literal — the same value. The document-level definition
        // under components.securitySchemes comes from this enum too, so an
        // operation cannot end up naming a scheme that was never declared.
        expect(BEARER_JWT_SCHEME).toBe(SwaggerSecurityScheme.BEARER_JWT);
    });
});

describe('generated OpenAPI — method-level @Authenticate', () => {
    const mixed = specOf(PartlyProtectedController);

    it('marks only the operation it sits on', () => {
        expect(mixed.paths['/mixed/closed']?.['get']?.security).toEqual([{ [BEARER_JWT_SCHEME]: [] }]);
    });

    it('leaves an undecorated sibling with no requirement at all', () => {
        // Which is exactly why the class-level form is the recommended default:
        // silence here means "public", and silence is what a forgotten decorator
        // produces.
        expect(mixed.paths['/mixed/open']?.['get']?.security).toBeUndefined();
    });
});

describe('generated OpenAPI — @RequireRoles', () => {
    const roled = specOf(RoledController);

    it('documents a 403 naming the roles that would satisfy it', () => {
        // The one place the requirement is visible to a reader of the document.
        // A 403 with no description would tell them the route can refuse and
        // nothing about why.
        expect(roled.paths['/roled/admin-only']?.['get']?.responses?.['403']?.description)
            .toContain('qr-manager.admin');
    });

    it('lists every accepted role, because any one of them is enough', () => {
        const description = roled.paths['/roled/either']?.['get']?.responses?.['403']?.description ?? '';

        expect(description).toContain('qr-manager.admin');
        expect(description).toContain('qr-manager.editor');
    });

    it('keeps the security requirement empty, as the spec demands for an http scheme', () => {
        // The tempting alternative is `{ BEARER_JWT: ['qr-manager.admin'] }`.
        // OpenAPI reserves that array for oauth2 and openIdConnect schemes and
        // requires it to be empty for `type: http` — which BEARER_JWT is. It
        // would render in Swagger UI and be wrong.
        expect(roled.paths['/roled/admin-only']?.['get']?.security).toEqual([{ [BEARER_JWT_SCHEME]: [] }]);
    });

    it('still documents 401 and 503 alongside the 403', () => {
        // Authorization is added to authentication, not swapped for it.
        const responses = roled.paths['/roled/admin-only']?.['get']?.responses ?? {};

        expect(Object.keys(responses)).toEqual(expect.arrayContaining(['401', '403', '503']));
    });

    it('puts the class-level requirement on a method that declares none', () => {
        // The path is '/roled', not '/roled/' — an earlier version of this test
        // asserted against the trailing-slash key, which does not exist, so it
        // passed by looking up nothing at all.
        expect(roled.paths['/roled']?.['get']?.responses?.['403']?.description)
            .toContain('qr-manager.reader');
    });

    it('documents the combined requirement, not just the nearer half', () => {
        // A reader-and-admin route that advertised only "admin" would send
        // somebody hunting for a role they already hold.
        const description = roled.paths['/roled/admin-only']?.['get']?.responses?.['403']?.description ?? '';

        expect(description).toContain('qr-manager.reader');
        expect(description).toContain('qr-manager.admin');
        expect(description).toContain(' and ');
    });

    it('inherits the class-level method rather than replacing it', () => {
        // The composition this design rests on: the method decorator adds
        // `roles` and the class decorator still supplies `method`, so the route
        // is authenticated as well as authorized.
        expect(roled.paths['/roled/admin-only']?.['get']?.security).toEqual([{ [BEARER_JWT_SCHEME]: [] }]);
    });

    it('puts no 403 on an anonymous route, which cannot refuse anyone for a role', () => {
        @Controller('/open')
        @Authenticate(TEST_METHOD)
        @RequireRoles('qr-manager.reader')
        class OpenController {
            @Get('/free')
            @Anonymous()
            free(): string {
                return 'free'; 
            }
        }

        const spec = specOf(OpenController);

        expect(spec.paths['/open/free']?.['get']?.responses?.['403']).toBeUndefined();
        expect(spec.paths['/open/free']?.['get']?.security).toEqual([]);
    });

    it('adds no 403 for a decorator that named no role at all', () => {
        // `@RequireRoles()` is a mistake, but it must not document a refusal the
        // guard will never produce — it treats an empty entry as no requirement.
        @Controller('/empty')
        @Authenticate(TEST_METHOD)
        class EmptyController {
            @Get('/')
            @RequireRoles()
            list(): string {
                return ''; 
            }
        }

        expect(specOf(EmptyController).paths['/empty']?.['get']?.responses?.['403']).toBeUndefined();
    });

    it('adds no vendor extension for the roles', () => {
        expect(JSON.stringify(roled)).not.toMatch(/"x-/);
    });
});
