import type { SourceDocument } from '../sources/SourceDocument.js';
import { sourceDocument } from './fakes.js';

/**
 * A small knowledge base in the dev KB's shape, for the controller tests. Each document is
 * about one topic of the fake embedder, so the vector leg has something to rank by.
 */
export const CORPUS: readonly SourceDocument[] = [
    sourceDocument('raw/2026-01-01-configmap-env-restart.md', [
        '# ConfigMap envFrom changes don\'t restart pods',
        '',
        '## Fact',
        '',
        'A pod keeps the environment it booted with. Editing the ConfigMap does not restart it.'
    ].join('\n'), {
        title: 'ConfigMap envFrom changes don\'t restart pods',
        date: '2026-01-01',
        metadata: { area: 'raw', type: 'gotcha', repos: ['homelab'] }
    }),
    sourceDocument('raw/2026-01-02-traefik-probe-port.md', [
        '# Traefik 8080 is load-bearing for probes',
        '',
        '## Fact',
        '',
        'The kubelet probes Traefik on port 8080. Removing the port took ingress down.'
    ].join('\n'), {
        title: 'Traefik 8080 is load-bearing for probes',
        metadata: { area: 'raw', type: 'gotcha', repos: ['homelab'] }
    }),
    sourceDocument('work/2026-01-03-backup-automation/spec.md', [
        '# Backup automation',
        '',
        '## Scope',
        '',
        'Automate the logical dumps; Longhorn volumes have no backup target.'
    ].join('\n'), {
        title: 'Backup automation',
        metadata: { area: 'work', status: 'draft', repos: ['homelab'] }
    }),
    sourceDocument('work/2026-01-04-volume-backup-target/spec.md', [
        '# Longhorn backup target',
        '',
        '## Scope',
        '',
        'Back up Longhorn volumes to MinIO.'
    ].join('\n'), {
        title: 'Longhorn backup target',
        metadata: { area: 'work', status: 'abandoned', repos: ['homelab'] }
    }),
    sourceDocument('raw/2026-01-05-backups-to-r2.md', [
        '# Backups go to R2',
        '',
        '## Decision',
        '',
        'Dumps are uploaded to R2 for now.'
    ].join('\n'), {
        title: 'Backups go to R2',
        metadata: { area: 'raw', type: 'decision', repos: ['homelab'] }
    }),
    sourceDocument('raw/2026-01-06-backups-are-dumps.md', [
        '# Backups are logical dumps, not Longhorn',
        '',
        '## Decision',
        '',
        'Backups are logical dumps written by a script; there is no Longhorn backup.'
    ].join('\n'), {
        title: 'Backups are logical dumps, not Longhorn',
        metadata: { area: 'raw', type: 'decision', repos: ['homelab'], supersedes: 'raw/2026-01-05-backups-to-r2.md' }
    }),
    sourceDocument('mirror/homelab-apps/README.md', [
        '# homelab-apps',
        '',
        '## Apps',
        '',
        'APIs and UIs.'
    ].join('\n'), {
        title: 'homelab-apps',
        metadata: { area: 'mirror', repos: ['homelab-apps'] }
    })
];
