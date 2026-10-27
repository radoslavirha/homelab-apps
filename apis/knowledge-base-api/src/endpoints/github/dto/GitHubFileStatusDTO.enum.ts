/** File statuses in a compare, as GitHub sends them. */
export enum GitHubFileStatusDTO {
    Added = 'added',
    Removed = 'removed',
    Modified = 'modified',
    Renamed = 'renamed',
    Copied = 'copied',
    Changed = 'changed',
    Unchanged = 'unchanged'
}
