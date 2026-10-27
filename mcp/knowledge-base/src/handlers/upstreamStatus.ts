import { Exception } from '@tsed/exceptions';

/** The status the upstream answered with, kept by http-provider as the translated error's `origin`. */
export const upstreamStatus = (error: unknown): number | undefined => {
    const origin = error instanceof Exception ? (error.origin as { response?: { status?: number } } | undefined) : undefined;

    return origin?.response?.status;
};
