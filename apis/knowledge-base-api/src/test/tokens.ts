// Kept apart from `fakes.ts`: importing `@radoslavirha/tsed-auth` registers its `AuthenticationService`
// provider, which a unit spec on `PlatformTest.create` cannot build without the app's `AuthProvider`.
import { mintTestToken } from '@radoslavirha/tsed-auth';
import { ROLE_ADMIN, ROLE_READER } from '../models/Roles.js';

export const readerToken = (): Promise<string> => mintTestToken({ claims: { roles: [ROLE_READER] } });

export const adminToken = (): Promise<string> => mintTestToken({ claims: { roles: [ROLE_READER, ROLE_ADMIN] } });

export const noRoleToken = (): Promise<string> => mintTestToken({ claims: { roles: [] } });
