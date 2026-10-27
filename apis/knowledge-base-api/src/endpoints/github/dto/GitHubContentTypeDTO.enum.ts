/** What a contents path holds, as GitHub sends it. */
export enum GitHubContentTypeDTO {
    File = 'file',
    Dir = 'dir',
    Symlink = 'symlink',
    Submodule = 'submodule'
}
