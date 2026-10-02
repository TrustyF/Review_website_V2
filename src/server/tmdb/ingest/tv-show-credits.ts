import { MediaType, type Prisma } from "@prisma/client";
import type { TmdbTvResponse } from "@/server/tmdb/schema";
import { syncTmdbCreditsAndGenres } from "@/server/tmdb/ingest/sync-credits";

// Flattens TV's aggregate_credits into the movie credit shapes, then shares the movie sync.
export async function syncTvShowCreditsAndGenres(
	tx: Prisma.TransactionClient,
	mediaId: number,
	data: TmdbTvResponse,
) {
	// Re-ordered by total_episode_count (not TMDB's order)
	const cast = [...data.aggregate_credits.cast]
		.sort((a, b) => b.total_episode_count - a.total_episode_count)
		.map((c, i) => ({
			id: c.id,
			name: c.name,
			character: c.roles.map((r) => r.character).join(" / "),
			order: i,
			profile_path: c.profile_path,
		}));
	// created_by is a separate top-level field (no "creator" job exists in aggregate_credits.crew),
	// folded in here as a synthetic "Creator" crew entry to match NOTABLE_CREW_JOBS.
	const creators = (data.created_by ?? []).map((c) => ({
		id: c.id,
		name: c.name,
		job: "Creator",
		department: "Creative",
		profile_path: c.profile_path,
	}));
	const crew = [
		...data.aggregate_credits.crew.flatMap((c) =>
			c.jobs.map((j) => ({
				id: c.id,
				name: c.name,
				job: j.job,
				department: c.department,
				profile_path: c.profile_path,
			})),
		),
		...creators,
	];

	await syncTmdbCreditsAndGenres(tx, mediaId, MediaType.TVSHOW, {
		genres: data.genres ?? [],
		cast,
		crew,
		companies: data.production_companies ?? [],
	});
}
