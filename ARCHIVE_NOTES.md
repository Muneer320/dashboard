# Ascent Dashboard archive notes

## What is preserved

The archive retains participant/admin React source, FastAPI services, schema and service-layer code, deployment scripts as historical references, Sidequest, the Mirage processor/mapping implementation, public event artwork and most commit history. It documents a team project, not a newly deployed event platform.

Operational database and credential exports, private environment examples, operational account seeds, sample identity manifests/download recipes, private payment/form destinations and unreviewed attachments were omitted or replaced. Some historical file versions are intentionally absent. Do not attempt to restore removed records, credentials or identity datasets from third-party copies.

The original private repository and preservation mirrors remain separate. Filtering this public copy does not rotate former credentials, change an organization's databases/storage, or certify cleanup of previously downloaded/cached copies. No such external action is claimed.

## Verified at archival publication

- Public frontend dependency install and production build pass on Node 24/Windows. A compatible React Router dependency refresh clears its production npm audit. The full development audit retains eight tooling findings (five high, two moderate, one low), and Vite reports a bundle-size warning. These checks do not certify the historical backend; the preview binds to loopback and no development server is exposed publicly.
- Real browser preview of public screens with the archive notice, bundled logo/artwork and desktop/phone layouts. Captures contain public design assets, not participant records or reconstructed app screens.
- Retained history checked for removed paths/objects and original private literals, with contributor identities/dates preserved. A standard history scan was supplemented with every reachable blob because diff scanning alone is insufficient for archive publication.
- The archive has no active deployment automation. Historical workflow definitions remain source references; GitHub Actions is disabled for the archival repository.

## What is not verified or supplied

- A fresh production/backend bootstrap. Migration numbers overlap, some operational seeds were removed, and multiple schema paths exist. Reconcile them deliberately before reuse; do not apply the migration folder blindly by filename.
- The former deployment, live Supabase/PostgreSQL/Redis, object storage, Google integrations, credentials or participant accounts.
- Mirage face matching, real-photo ingestion, enrollment or a biometric-data lifecycle. No real identity dataset is included or tested here. Its original [design document](docs/architecture/mirage-hld.md) describes architecture, not validation evidence.
- The old backend's full test suite. An earlier audit reported two failing tests; that suite has not been rerun for this source-only archive. Authorization and coin-balance/concurrency issues also require review before any future deployment.
- Adoption, attendance, accuracy or throughput metrics. Figures retained inside the event's promotional UI are historical copy, not measurements established by this archive.

## Source map

| Directory | Role |
| --- | --- |
| `frontend/` | Main participant/admin web interfaces and public preview |
| `backend/app/` | API routes, models, services and background-job integration |
| `backend/migrations/` | Historical schema evolution; not a validated fresh-install sequence |
| `processor/mirage_processor/` | Mirage inference/ingestion/worker implementation |
| `mirage-mapping-dashboard/` | Operator interface for the processor |
| `infra/` | Historical infrastructure/deployment support |

## Continuing in a fork

Start from synthetic inputs and an isolated development environment. Inventory all auth/role boundaries and migrations, replace historical defaults, test concurrency, establish a privacy/data-retention policy, and configure owned services before claiming a working deployment. Never reconnect the archive to old production resources by copying configuration from another environment.

Keep the original contributor history and subsystem credits. Muneer's foundation/API/cache/admin work and X-DIABLO-X's Mirage implementation are examples of different areas within the same team project. No blanket team-code license was found; clarify permission with the relevant authors for reuse beyond the applicable platform rights and dependency licenses.
