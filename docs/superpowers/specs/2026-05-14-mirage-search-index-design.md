# Mirage Participant Search Index Design

## Summary

Add a dedicated Mirage search index for logged-in users so they can search every participant in Mirage by name, username, email, or user ID and then open a participant profile card into that participant's Mirage gallery.

This design introduces a person-first search experience backed by dedicated index tables rather than direct live joins across Mirage pipeline tables on every query.

## Goals

- Let logged-in users search every participant in Mirage.
- Show participant profile cards first, not direct photo results.
- Open a participant-specific Mirage gallery after card selection.
- Keep search fast and stable as Mirage data grows.
- Keep the search index derived from existing Mirage mappings rather than manual data entry.

## Non-Goals

- Event-based search.
- Anonymous/public search.
- Manual admin editing of search rows.
- Full-text search infrastructure outside Postgres.
- Replacing the existing Mirage mapping pipeline as the source of truth.

## User Experience

### Entry point

Add a search bar near the top of the Mirage page for authenticated users.

### Search behavior

- Search starts after at least 2 characters.
- Queries match against participant name, username, email, and exact user ID.
- Results are shown as participant profile cards.
- Cards are sorted by relevance first, then by recency and photo count.

### Participant card

Each result card shows:

- cover photo
- participant name
- username or email
- total mapped photo count

### Participant gallery

Clicking a profile card opens a participant-specific Mirage gallery view.

That gallery shows:

- all mapped Mirage photos for that participant
- day labels when available
- existing Mirage photo interactions that already apply in the app

The participant gallery is a detail view of the search result, not a separate admin-only screen.

## Data Model

Use two dedicated tables.

### `mirage_search_people`

One row per searchable participant.

Columns:

- `user_id uuid primary key references users(id) on delete cascade`
- `email text null`
- `username text null`
- `name text null`
- `photo_count integer not null default 0`
- `cover_photo_id uuid null references mirage_job_images(id) on delete set null`
- `latest_photo_at timestamptz null`
- `search_text text not null default ''`
- `is_searchable boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- btree on `user_id`
- btree on `photo_count desc`
- btree on `latest_photo_at desc`
- btree on `is_searchable`
- trigram or lower-text index on `search_text`
- lower-case indexes on `email`, `username`, and `name` if trigram is not used

Notes:

- `search_text` is a normalized concatenation of searchable identity fields.
- `cover_photo_id` points to the participant's preferred preview photo.
- `is_searchable` allows product control without deleting index state.

### `mirage_search_person_photos`

One row per participant-photo relation.

Columns:

- `user_id uuid not null references users(id) on delete cascade`
- `photo_id uuid not null references mirage_job_images(id) on delete cascade`
- `job_id uuid null references mirage_jobs(id) on delete set null`
- `day_label text null`
- `display_order integer not null default 0`
- `publish_state text not null default 'published'`
- `gallery_visibility text not null default 'live'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints and indexes:

- unique index on `(user_id, photo_id)`
- btree on `(user_id, display_order)`
- btree on `(user_id, created_at desc)`
- btree on `(publish_state, gallery_visibility)`

Notes:

- `event_id` is intentionally excluded.
- This table is an index, not the source of truth for mappings.

## Source of Truth

The search index is derived from existing Mirage data:

- `users`
- `image_user_mappings`
- `mirage_job_images`
- `mirage_jobs`

The search tables must never become the authoritative source of mapping truth. They are a cached relational projection optimized for user-facing search.

## Index Inclusion Rules

A participant should appear in `mirage_search_people` when all of the following are true:

- the participant exists in `users`
- the participant has at least one Mirage mapping
- the participant is meant to be searchable in the logged-in Mirage product

A participant photo should appear in `mirage_search_person_photos` when it is associated through Mirage mappings and is allowed to surface in the logged-in Mirage experience.

Default rule for first implementation:

- only include rows where mapping `publish_state = 'published'`
- only include rows where job `gallery_visibility = 'live'`

This matches current Mirage visibility behavior and avoids leaking draft or staged content.

## Sync Strategy

### Recommendation

Maintain the index with backend service-level refresh functions called from Mirage publish and mapping workflows.

This is the simplest reliable first version and avoids introducing database triggers before the product behavior is stable.

### Required service functions

- `refresh_mirage_search_person(user_id)`
- `refresh_mirage_search_people_for_job(job_id)`
- `delete_mirage_search_person_if_empty(user_id)`

### Refresh triggers

Refresh affected users when:

- a mapping is published
- a mapping is unpublished or deleted
- a mapped image is removed
- a Mirage job changes gallery visibility
- a user's `name`, `username`, or email changes

### Refresh algorithm

For one affected user:

1. Load the user's identity fields from `users`.
2. Load all eligible mapped photos from `image_user_mappings` joined to `mirage_job_images` and `mirage_jobs`.
3. Replace that user's rows in `mirage_search_person_photos` with the fresh eligible set.
4. Recompute `photo_count`, `latest_photo_at`, `cover_photo_id`, and `search_text`.
5. Upsert `mirage_search_people` if the user still has eligible photos.
6. Delete the `mirage_search_people` row if no eligible photos remain.

### Cover photo rule

Use the best available candidate in this order:

1. newest eligible photo
2. otherwise lowest `display_order` among eligible photos
3. otherwise null if no eligible photos exist

This rule is simple and deterministic for the first release.

## API Design

### `GET /api/v1/mirage/search/people`

Authenticated endpoint for search cards.

Query params:

- `q`: required search text
- `limit`: optional, default 8, max 20

Response shape:

- `query`
- `people`

Each person item:

- `userId`
- `name`
- `username`
- `email`
- `photoCount`
- `coverPhoto`
- `latestPhotoAt`

`coverPhoto` should use existing Mirage photo serialization shape where practical so the frontend can reuse image rendering patterns.

### `GET /api/v1/mirage/search/people/{user_id}`

Authenticated endpoint for participant gallery detail.

Response shape:

- `participant`
- `photos`

`participant`:

- `userId`
- `name`
- `username`
- `email`
- `photoCount`
- `coverPhoto`

`photos`:

- standard Mirage photo items already used by collection and personal gallery views

## Frontend Design

### Mirage page search shell

Add a search module to the main Mirage page.

States:

- idle
- loading
- results
- empty
- error

Behavior:

- debounce requests on typing
- clear results when query becomes shorter than 2 characters
- keep search and gallery state independent from the collection browsing state

### Search results

Render profile cards in a responsive grid or stacked list depending on viewport.

Card interactions:

- click card opens participant gallery
- card remains lightweight and does not pre-load full photo sets

### Participant gallery detail

Open as an inline detail section inside the Mirage page for the first release, reusing the existing Mirage photo grid and lightbox patterns. Avoid introducing a new route unless the product later needs shareable participant-gallery URLs.

## Performance Expectations

- search request should not depend on heavy runtime joins across all Mirage mapping tables
- profile-card queries should hit `mirage_search_people` only
- participant gallery detail should query only one participant's indexed photo rows plus the referenced photo metadata
- debounce on the frontend should keep search traffic low

## Error Handling

- if search index tables are missing, the API should fail with a clear Mirage search configuration error
- if a participant exists but has no eligible indexed photos, their detail endpoint should return not found
- if cover photo metadata is stale, the refresh flow should repair it on next affected update

## Security and Access

- only logged-in users can use Mirage participant search
- anonymous users must not access search endpoints
- search should only surface data already allowed in the logged-in Mirage experience
- draft or non-live Mirage content must not leak through the index

## Migration Plan

Add a migration that:

1. creates `mirage_search_people`
2. creates `mirage_search_person_photos`
3. creates required indexes
4. adds `updated_at` triggers following the existing Mirage table pattern

After deployment:

1. run a one-time backfill from current Mirage mappings
2. enable application-level refresh hooks for future changes

## Testing Plan

### Backend

- unit tests for refresh logic
- route tests for search list and participant detail endpoints
- auth tests verifying endpoints require logged-in users
- tests confirming non-live or unpublished mappings do not appear
- tests confirming user rename refresh updates search results

### Frontend

- Mirage search input interaction tests
- loading, empty, and error state coverage
- card click opens participant gallery
- participant gallery renders indexed photos correctly

## Open Decisions Resolved

- Search audience: logged-in users only
- Search scope: every participant in Mirage
- Search UX: profile card first, participant gallery second
- Event link: excluded from the index model
- Recommended architecture: dedicated search index tables

## Implementation Notes

- Reuse existing Mirage photo serialization helpers where possible.
- Keep search schemas separate from the public collection schemas to avoid overloading unrelated response models.
- Add the feature incrementally: migration and backfill first, then endpoints, then UI.
