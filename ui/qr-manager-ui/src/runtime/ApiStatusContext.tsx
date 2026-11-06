import { createContext, useContext, type ReactNode } from 'react';
import type { RequestOutcome } from '@radoslavirha/ui-runtime';

/**
 * Lets any page report the outcome of a real request without threading a
 * callback through props. The app derives its view of the backend from the
 * requests it already makes — it does not poll a health endpoint.
 */
const ApiStatusContext = createContext<((outcome: RequestOutcome) => void) | null>(null);

/** Increments each time the API goes from degraded back to `ok`. */
const ApiRecoveryContext = createContext<number>(0);

export const ApiStatusProvider = (
    { report, recoveryCount = 0, children }: {
        report: (outcome: RequestOutcome) => void;
        recoveryCount?: number;
        children: ReactNode;
    }
) => (
    <ApiStatusContext.Provider value={report}>
        <ApiRecoveryContext.Provider value={recoveryCount}>{children}</ApiRecoveryContext.Provider>
    </ApiStatusContext.Provider>
);

/**
 * A counter that changes whenever the API recovers. A page whose last load
 * failed uses it to load again; a page that loaded fine must ignore it.
 */
export const useApiRecoveryCount = (): number => useContext(ApiRecoveryContext);

export const useReportApiOutcome = (): ((outcome: RequestOutcome) => void) => {
    const report = useContext(ApiStatusContext);
    if (!report) {
        throw new Error('useReportApiOutcome called outside of <ApiStatusProvider>.');
    }
    return report;
};
