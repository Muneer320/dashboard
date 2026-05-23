# Historical schema migrations

These SQL/Python files preserve Ascent Dashboard's schema evolution. They are not a verified fresh-install sequence: numbers overlap, an additional schema exists under `supabase/`, and operational account/test seeds have been removed from the public archive.

Do not apply this folder blindly in filename order. A future fork must reconcile the schema and migration graph against its models, then verify apply/reverse/bootstrap behavior with synthetic data in an isolated database. Do not use the former team's credentials or records.

See the [archive notes](../../ARCHIVE_NOTES.md) for the exact verification boundary and the [API source guide](../README.md) for context. Original application and contributor history is preserved; no production migration result is claimed here.
