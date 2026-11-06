import { UNAUTHENTICATED_ISSUER } from '@radoslavirha/auth';
import { PrincipalService } from '@radoslavirha/tsed-auth';
import { CommonUtils } from '@radoslavirha/utils';
import { ProviderScope, Scope, Service } from '@tsed/di';
import { DocumentValidationService } from './DocumentValidationService.js';

/**
 * Who a write is for: the `On-Behalf-Of` header the caller sent, checked by
 * `DocumentValidationService.onBehalfOf`.
 *
 * One fallback, and only under an `unauthenticated` auth entry: when the header is **absent**,
 * the write is for the caller's own subject (the entry's `defaultSubject`, or its unverified
 * `subjectHeader` label). That lets a direct REST caller (curl) write without naming anyone, and
 * the MCP, which always sends the header, is unaffected.
 *
 * Behind an IdP the header stays mandatory. The verified caller there is usually a service
 * account, and its `sub` is not the username of a person — writing it into a commit trailer or a
 * note's `author:` would be wrong, not merely unhelpful. A header that is present but malformed is
 * refused under every auth type.
 */
@Service()
@Scope(ProviderScope.SINGLETON)
export class OnBehalfOfService {
    public constructor(
        private readonly principals: PrincipalService,
        private readonly validation: DocumentValidationService
    ) {}

    public resolve(header: string | undefined): string {
        if (CommonUtils.isNil(header)) {
            const principal = this.principals.require();

            if (principal.issuer === UNAUTHENTICATED_ISSUER) {
                return this.validation.onBehalfOf(principal.subject);
            }
        }

        return this.validation.onBehalfOf(header);
    }
}
