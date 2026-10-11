import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell, ApiStatusBanner } from '@radoslavirha/ui-kit';
import { useApiStatus } from '@radoslavirha/ui-runtime';
import { AuthProvider, createAuthClient, useAuth } from '@radoslavirha/ui-auth';
import { QrCodeListPage } from './pages/QrCodeListPage.js';
import { QrCodeDetailPage } from './pages/QrCodeDetailPage.js';
import { QrCodeCreatePage } from './pages/QrCodeCreatePage.js';
import { CallbackPage } from './pages/CallbackPage.js';
import { SignInPage } from './pages/SignInPage.js';
import { createQrCodesClient } from './api/qrCodes.js';
import { RuntimeConfigProvider } from './runtime/RuntimeConfigContext.js';
import { ApiStatusProvider } from './runtime/ApiStatusContext.js';
import type { RuntimeConfig } from './runtime/RuntimeConfig.js';

interface Props {
    config: RuntimeConfig;
}

const AuthControls = () => {
    const { username, logout } = useAuth();

    // Only ever rendered inside <Protected>, so the user is authenticated by
    // construction — there is no anonymous or loading branch to handle.
    return (
        <>
            <span className="app-nav-link">{username}</span>
            {/*
              One button, and it really logs you out: the provider's invalidation
              flow ends the IdP session, so this signs you out of every app behind
              it rather than leaving a session that silently signs you back in.
            */}
            <button className="app-nav-link" onClick={() => void logout()}>Log out</button>
        </>
    );
};

/**
 * Nothing of the application renders until the user is known to be signed in.
 *
 * `loading` is not merely "waiting": the provider may be about to navigate the
 * page to the IdP to pick up an existing SSO session. Rendering the app, or the
 * sign-in page, during that window would flash the wrong thing every time.
 */
const Protected = ({ children }: { children: ReactNode }) => {
    const { state } = useAuth();

    if (state === 'loading') {
        return <p className="app-loading">Loading…</p>;
    }

    if (state === 'anonymous') {
        return <SignInPage />;
    }

    return <>{children}</>;
};

/** The nav is part of the application, so it stays hidden until sign-in too. */
const HeaderNav = () => {
    const { state } = useAuth();

    if (state !== 'authenticated') {
        return null;
    }

    return (
        <nav className="app-nav">
            <NavLink to="/admin" end className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
                List
            </NavLink>
            <NavLink to="/admin/new" className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}>
                New
            </NavLink>
            <AuthControls />
        </nav>
    );
};

/**
 * `App` sits above `AuthProvider`, but the recovery probe needs the bearer
 * token. This hands the provider's getter up through a ref; it renders nothing.
 */
const TokenBridge = ({ target }: { target: { current: () => string | undefined } }) => {
    const { getAccessToken } = useAuth();

    useEffect(() => {
        target.current = getAccessToken;
    }, [target, getAccessToken]);

    return null;
};

export const App = ({ config }: Props) => {
    const tokenRef = useRef<() => string | undefined>(() => undefined);
    // The banner says "retrying" while the API is degraded, so something must
    // actually retry. The probe is an authenticated list call: an anonymous one
    // would answer 401 and never read as recovered.
    const { status, report } = useApiStatus({
        recoveryProbe: {
            probe: async () => {
                try {
                    await createQrCodesClient(config.apiBaseURL, {
                        getAccessToken: () => tokenRef.current()
                    }).list({});
                    return true;
                } catch {
                    return false;
                }
            }
        }
    });
    const authClient = useMemo(() => createAuthClient(config.auth), [config.auth]);

    return (
    <RuntimeConfigProvider value={config}>
        <ApiStatusProvider report={report}>
        <BrowserRouter basename={config.basePath}>
            {/* Inside BrowserRouter: CallbackPage navigates once the exchange lands. */}
            <AuthProvider client={authClient}>
            <TokenBridge target={tokenRef} />
            <AppShell
                headerLeft={
                    <Link to="/admin" className="app-logo">QR Manager</Link>
                }
                headerRight={<HeaderNav />}
            >
                <ApiStatusBanner status={status} serviceName="QR Manager API" />
                <Routes>
                    {/*
                      /callback is outside the gate on purpose: it is how a user
                      BECOMES authenticated, so gating it would deadlock the login.
                    */}
                    <Route path="/callback" element={<CallbackPage client={authClient} />} />
                    <Route
                        path="*"
                        element={
                            <Protected>
                                <Routes>
                                    <Route path="/" element={<Navigate to="/admin" replace />} />
                                    <Route path="/admin" element={<QrCodeListPage />} />
                                    <Route path="/admin/new" element={<QrCodeCreatePage />} />
                                    <Route path="/admin/:id" element={<QrCodeDetailPage />} />
                                </Routes>
                            </Protected>
                        }
                    />
                </Routes>
            </AppShell>
            </AuthProvider>
        </BrowserRouter>
        </ApiStatusProvider>
    </RuntimeConfigProvider>
    );
};
