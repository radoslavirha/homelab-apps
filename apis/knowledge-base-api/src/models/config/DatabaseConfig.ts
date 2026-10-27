import { CommonUtils } from '@radoslavirha/utils';
import z from 'zod';
import { SslMode } from './SslMode.enum.js';

export const DatabaseConfigSchema = z.object({
    host: z.string().min(1),
    port: z.number().int().positive().default(5432),
    database: z.string().min(1),
    user: z.string().min(1),
    password: z.string().min(1),
    sslMode: z.enum(SslMode).default(SslMode.Disable)
        .describe('TLS towards Postgres. CloudNativePG serves TLS with its own CA: REQUIRE encrypts without verifying it.'),
    caFile: z.string().optional().describe('PEM bundle to verify the server against. Required for VERIFY_FULL.'),
    pool: z.object({
        max: z.number().int().positive().default(5)
            .describe('One connection is held for the whole indexing run (the advisory lock lives on it).'),
        idleTimeoutMs: z.number().int().nonnegative().default(30_000),
        connectionTimeoutMs: z.number().int().positive().default(5_000)
    }).prefault({}),
    statementTimeoutMs: z.number().int().positive().default(30_000)
}).refine((db) => db.sslMode !== SslMode.VerifyFull || CommonUtils.notUndefined(db.caFile), {
    message: 'database.caFile is required when sslMode is VERIFY_FULL',
    path: ['caFile']
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
