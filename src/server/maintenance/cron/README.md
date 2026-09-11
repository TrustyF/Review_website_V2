# Maintenance/cron scripts

All of these are `npm run <script>` entries (see root `package.json`) meant to run
against the production DB on the host (thinkguy), inside the `maintenance` compose
service — not `app` (trimmed runtime image, no tsx/devDependencies) and not locally
against prod data.

From the repo dir on the host:

```bash
sudo docker compose run --rm maintenance npm run <script> [-- <args>]
```

## Scheduled (see `crontab.example` for the live schedule)

- `enrich_db` — nightly TMDB/IGDB/ComicVine/Google Books/MangaDex sync for stale
  media rows (`lastEnrichedAt` > 3 days old, or null). Optional args:
  - media type filter, e.g. `-- movie` or `-- movie,tvshow` (case-insensitive,
    comma/space-separated; default is all types)
  - `-- ignore-enrich-cutoff` to re-enrich every matching row regardless of
    `lastEnrichedAt`, for testing ingest changes — combine with a type filter,
    e.g. `-- movie ignore-enrich-cutoff`
- `cleanup_posters` — nightly, deletes orphaned poster/cropped-image files
- `cleanup_cropped_images` — nightly, same idea for cropped images
- `purge_deleted_changelogs` — weekly, purges soft-deleted change-log rows past
  their retention window

## Manual / one-off

- `weekly_digest` — CLI/manual send of the weekly digest email; normally sent
  from `/admin/digest` instead (see `digest-send-actions.ts`)
- `backup_database` — invoked directly by the host's crontab (not through
  `run-and-notify.sh`), does its own dump + R2 upload + pruning
- `purge_non_notable_crew` — one-off cleanup script, not scheduled

## Dev-only (`src/scripts/dev/`, run locally, not via `maintenance`)

- `promote_admin` — promote a user to ADMIN by email
- `add_movies_to_list` — bulk-add movies to a list
- `clear_image_caches` — clear local image cache dirs
- `seed_email_preview` — seed data for `email_dev` previews
- `find-wrong-game-release-dates.ts` / `fix-wrong-game-release-dates.ts` — no
  npm script entries yet, run with `tsx src/scripts/dev/<file>.ts` directly

## Legacy (`src/scripts/legacy/`, no npm script entries — one-off migrations)

`mysql-migration.ts`, `backfill-person-photos.ts`, `backfill-review-created-date.ts`,
`backfill-banners.ts`, `backfill-direct-link.ts`, `backfill-source-url.ts` — kept for
reference, not expected to run again.
