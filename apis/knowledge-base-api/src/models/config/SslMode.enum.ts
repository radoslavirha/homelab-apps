/**
 * TLS towards Postgres, named after libpq's `sslmode` values of the same meaning.
 */
export enum SslMode {
    /** Plaintext. Local development and the test container only. */
    Disable = 'DISABLE',
    /** Encrypted, server certificate not verified — libpq `sslmode=require`. */
    Require = 'REQUIRE',
    /** Encrypted and verified against `caFile`, hostname included — libpq `sslmode=verify-full`. */
    VerifyFull = 'VERIFY_FULL'
}
