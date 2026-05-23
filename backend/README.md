# Ascent API source archive

The FastAPI backend for Ascent 2026 connected participant accounts, event/team state, submissions, QR validation, admin tools, caching and the Mirage/Sidequest workflows. It is preserved here as implementation history, with operational records, credentials and account seeds removed.

The maintained entry point for this copy is the [main archive README](../README.md). Its [archive notes](../ARCHIVE_NOTES.md) distinguish the verified public frontend preview from the historical backend and list known limitations.

The source is organized under `app/api/routes`, `app/services`, `app/models` and `app/core`; the dependency manifest is `pyproject.toml`. It originally used PostgreSQL/Supabase, Redis, object storage and optional Google integrations. Provider credentials and event databases are not supplied.

This is not a copy-and-run backend quickstart. The previous environment example and operational seed accounts were intentionally removed; migration ordering and authorization/concurrency debt must be reviewed before reuse. The earlier audit reported two failing tests, and the full backend suite was not rerun for archival publication. Old defaults must never be treated as production-safe secrets.

Use synthetic records and owned, isolated services if continuing in a fork. Retain the original team and Mirage contribution credits in the main README; no repository-wide team-code license is asserted.
