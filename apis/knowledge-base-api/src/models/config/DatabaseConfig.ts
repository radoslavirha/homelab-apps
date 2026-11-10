import { CommonUtils } from '@radoslavirha/utils';
import z from 'zod';
import { SslMode } from './SslMode.enum.js';

export const DatabaseConfigSchema = z.object({
    host: z.string().min(1).describe('Postgres host.'),
    port: z.number().int().positive().default(5432).describe('Postgres port.'),
    database: z.string().min(1).describe('Database name. One database per environment: migrations run on it at boot.'),
    user: z.string().min(1).describe('Role the service connects as.'),
    password: z.string().min(1).describe('Password of `user`.'),
    sslMode: z.enum(SslMode).default(SslMode.Disable)
        .describe('TLS towards Postgres. CloudNativePG serves TLS with its own CA: REQUIRE encrypts without verifying it.'),
    caFile: z.string().optional().describe('PEM bundle to verify the server against. Required for VERIFY_FULL.'),
    pool: z.object({
        max: z.number().int().positive().default(5)
            .describe('One connection is held for the whole indexing run (the advisory lock lives on it).'),
        idleTimeoutMs: z.number().int().nonnegative().default(30_000)
            .describe('How long an idle connection stays open before the pool closes it (pg `idleTimeoutMillis`).'),
        connectionTimeoutMs: z.number().int().positive().default(5_000)
            .describe('How long acquiring a new connection may take before it fails (pg `connectionTimeoutMillis`).')
    }).prefault({}).describe('Connection pool (`pg.Pool`).'),
    statementTimeoutMs: z.number().int().positive().default(30_000)
        .describe('Postgres `statement_timeout` set on every connection: a longer statement is cancelled.')
}).refine((db) => db.sslMode !== SslMode.VerifyFull || CommonUtils.notUndefined(db.caFile), {
    message: 'database.caFile is required when sslMode is VERIFY_FULL',
    path: ['caFile']
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
