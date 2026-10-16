/** Tree entry types as GitHub sends them: a file, a directory, a submodule. */
export enum GitHubTreeEntryTypeDTO {
    Blob = 'blob',
    Tree = 'tree',
    Commit = 'commit'
}
