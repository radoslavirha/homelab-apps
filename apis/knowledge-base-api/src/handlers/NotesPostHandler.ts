import { CommonUtils } from '@radoslavirha/utils';
import { Injectable, ProviderScope, Scope } from '@tsed/di';
import { BadRequest } from '@tsed/exceptions';
import { DocumentWriteMapper } from '../mappers/DocumentWriteMapper.js';
import type { NotesPostRequest } from '../models/NotesPostRequest.js';
import type { NotesPostResponse } from '../models/NotesPostResponse.js';
import { DocumentValidationService } from '../services/DocumentValidationService.js';
import { DocumentWriteService } from '../services/DocumentWriteService.js';
import { KnowledgeBaseAccessService } from '../services/KnowledgeBaseAccessService.js';
import { NoteRenderService } from '../services/NoteRenderService.js';

@Injectable()
@Scope(ProviderScope.SINGLETON)
export class NotesPostHandler {
    public constructor(
        private readonly access: KnowledgeBaseAccessService,
        private readonly notes: NoteRenderService,
        private readonly validation: DocumentValidationService,
        private readonly writes: DocumentWriteService,
        private readonly mapper: DocumentWriteMapper
    ) {}

    /** Renders the note, refuses a secret or a `supersedes` that names no note, and commits it as a create. */
    public async execute(request: NotesPostRequest, header: string | undefined): Promise<NotesPostResponse> {
        const onBehalfOf = this.validation.onBehalfOf(header);
        const [kb] = this.access.resolve(request.kb);
        const note = this.notes.render(request, onBehalfOf);

        this.validation.refuseSecrets(note.content, 'the note');

        if (CommonUtils.notUndefined(request.supersedes) && CommonUtils.isNull(await this.writes.read(kb, request.supersedes))) {
            throw new BadRequest(`supersedes: ${request.supersedes} does not exist.`);
        }

        const result = await this.writes.write(kb, note.id, note.content, null, { onBehalfOf, subject: note.title });

        return this.mapper.toNotesPostResponse(note.id, result);
    }
}
