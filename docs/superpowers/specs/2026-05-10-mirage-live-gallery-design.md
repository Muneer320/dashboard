# Mirage Live Gallery Incremental Mapping Design

## Goal

Keep Mirage images continuously visible after the first publish while allowing incremental processing of newly verified users against the same job without creating downtime or requiring a new job record.

## Problem

The current Mirage workflow couples image visibility, mapping generation, approval, and publish too tightly. When new user mappings are processed against an already live job, the job status transitions can temporarily hide images for everyone even though only personalized mappings are changing. This creates avoidable downtime and makes incremental processing unsafe.

## Desired Behavior

- A single Mirage job remains the canonical gallery set for an event/day.
- The first publish makes that job's images live.
- Later runs for newly verified users reuse the same Mirage job.
- Incremental runs add or update mappings only; they do not remove live image visibility.
- `Unpublish` remains a manual hard switch that hides the gallery whenever needed.
- Existing live images and existing user mappings remain visible during incremental processing, approval, and publish.
- New mappings appear only after approval and publish of that incremental batch.

## Core Model

Separate two concepts that are currently mixed together:

1. Gallery visibility
2. Processing batch state

Gallery visibility answers whether images are visible to users.
Processing batch state answers what the local processor is currently doing.

An event/day can therefore be:

- gallery visibility: `draft`, `live`, or `unpublished`
- batch state: `idle`, `discovering`, `downloading`, `detecting_faces`, `matching_users`, `writing_mappings`, `awaiting_approval`, `failed`

This separation ensures a live gallery stays live while new user mappings are being processed.

## Canonical Job Model

- There is one long-lived Mirage job per event/day gallery set.
- The same job is reused for later user-processing runs.
- Incremental runs do not create a new job row.
- The same job stores images, aggregate job stats, and live gallery identity.

This job acts as the durable owner of:

- the gallery image set
- the published/unpublished state
- the accumulated user-image mappings

## Publishing Model

### First Publish

The first publish does all of the following:

- marks the gallery as live
- makes images visible to users
- publishes the first approved set of mappings

### Incremental Publish

Later publishes do only this:

- merge newly approved mappings into the already-live gallery

Later publishes must not:

- hide existing images
- reset live visibility
- require gallery images to leave the live state
- remove prior mappings unless explicitly replaced for the same user/image/model tuple

## Approval Model

Approval should operate on the latest incremental mapping batch, not on the entire gallery.

### First Approval

- validates the first processing run
- prepares the first publish

### Incremental Approval

- validates only the new or updated mapping results
- leaves already published image visibility untouched
- leaves already published mappings untouched unless an updated mapping for the same target supersedes them

## Unpublish Model

`Unpublish` remains a manual operator control.

When used, it should:

- hide all Mirage images and mappings for the selected gallery set
- preserve historical job data and mappings in the database
- allow republish later without rebuilding the gallery from scratch

It should not:

- delete job images
- delete mappings
- destroy audit history

## User-Facing Mirage Page

The Mirage page should behave like this:

- all live images are always visible while the gallery is published
- personalized mappings are layered on top of the live images
- if a user has no current mappings yet, they still see the live gallery
- once new mappings are approved and published, the user's personalized gallery updates automatically without any gallery downtime

This means image visibility is global while mapping visibility is personalized.

## Failure Semantics

If an incremental run fails halfway:

- already live images remain visible
- already published mappings remain visible
- only the new batch stays pending or failed
- operators can rerun only the new work without disrupting published content

## Dashboard / Ops UX

The mapping dashboard should expose the processing model directly.

Recommended controls:

- `Run local GPU + upload mappings`
- `Process newly verified users`
- `Approve new mappings`
- `Publish mapping updates`
- `Unpublish gallery`

Recommended progress stages:

- `discovering images`
- `downloading`
- `detecting faces`
- `matching verified users`
- `writing mappings`
- `awaiting approval`
- `published`

Recommended progress metrics:

- processed images / total images
- processed verified users / total verified users
- pending new-user mappings
- current gallery visibility (`live` or `unpublished`)
- current batch state

## Processor / Performance

The processor should support bounded parallelism for:

- image inference within a job
- user anchor verification across users

Parallelism must be bounded by configurable worker counts to avoid VRAM exhaustion.

The implementation should prefer:

- concurrency for I/O-heavy steps such as downloads and DB writes
- bounded worker pools for GPU-backed inference
- reuse of loaded models and embedding caches within a run

## Redis / Read Caching

Mirage should use Redis caching for read-heavy user-facing surfaces if not already in place.

Recommended cache targets:

- live gallery image list
- personalized per-user mapping results

Cache invalidation points:

- first publish
- incremental publish
- unpublish
- mapping overwrite for a user

Signed URLs should not be cached longer than their validity window, and derived gallery metadata should be preferred for cache storage.

## Data Model Changes

The current schema needs a notion of incremental mapping batches without introducing new job rows.

Recommended additions:

- a persistent gallery visibility field on the Mirage job
- a current batch processing state field on the Mirage job
- a way to mark mappings as belonging to the latest incremental publish candidate
- a way to distinguish already published mappings from newly staged mappings

This can be represented either by:

- explicit batch identifiers attached to mapping rows, or
- a staging/published state on mappings plus job-level batch metadata

Recommended direction:

- keep the job row as the durable gallery owner
- introduce batch metadata for incremental runs
- stage new mappings during processing
- approve staged mappings
- publish staged mappings by promoting them to published state

## Backward Compatibility

Existing live galleries must continue to work after this change.

Migration-safe behavior:

- existing `live` jobs should remain visible
- old mapping rows should be treated as already published
- incremental runs on old jobs should populate the new staged/published mapping state without removing existing visibility

## Testing Strategy

The implementation should add automated coverage for:

- first publish makes images live
- incremental processing leaves live images visible
- incremental approval stages only new mappings
- incremental publish adds new mappings without hiding existing images
- unpublish hides images and mappings
- failed incremental runs do not disrupt existing live content
- dashboard progress updates during processing
- verified-user counts and pending-pair counts stay accurate during incremental runs

## Recommended Implementation Order

1. Add job visibility and batch-state model in backend schema/service layer.
2. Update Mirage read APIs so live image visibility is independent from processing state.
3. Add staged/published mapping semantics for incremental runs.
4. Update processor write paths to stage new mappings instead of replacing live state.
5. Add approve/publish/unpublish behavior for incremental batches.
6. Update dashboard progress UI and operator controls.
7. Add Redis caching and invalidation for live Mirage reads.

## Out of Scope

- Multi-job galleries for the same event/day
- Full historical timeline UI for every incremental mapping batch
- End-user controls over publish visibility

## Recommendation

Implement Mirage as a persistent live gallery with incremental mapping merges on the same job row. This directly matches the desired operator workflow, prevents image downtime, and keeps the user-facing Mirage page stable while new users are processed in the background.
