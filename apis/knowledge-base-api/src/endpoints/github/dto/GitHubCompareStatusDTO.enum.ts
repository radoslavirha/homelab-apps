/** Compare statuses as GitHub sends them. Only `ahead` and `identical` diff cleanly from the base. */
export enum GitHubCompareStatusDTO {
    Ahead = 'ahead',
    Behind = 'behind',
    Diverged = 'diverged',
    Identical = 'identical'
}
