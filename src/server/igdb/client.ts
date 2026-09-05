import {
	IgdbCoverListSchema,
	IgdbGame,
	IgdbGameLocalizationListSchema,
	IgdbGamesResponseSchema,
	IgdbGameSearchResponseSchema,
	IgdbGameSearchResult,
} from "./schema";
import { parseOrThrow } from "@/lib/arktype/parse-or-throw";
import { createRateLimiter } from "@/server/lib/rate-limited-fetch";
import { cachedJson } from "@/server/lib/response-cache";

const IGDB_BASE = "https://api.igdb.com/v4";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";

const GAME_FIELDS = [
	"name",
	"url",
	"summary",
	"first_release_date",
	// Per-release dates (e.g. early access vs. full 1.0) — first_release_date alone can reflect
	// whichever release IGDB currently considers "main" rather than the earliest one.
	"release_dates.date",
	"total_rating",
	"status",
	"genres.name",
	"involved_companies.company.id",
	"involved_companies.company.name",
	"involved_companies.developer",
	"involved_companies.publisher",
	"cover.image_id",
	"platforms.name",
	"artworks.image_id",
	"artworks.width",
	"artworks.height",
].join(", ");

// IGDB uses Twitch's OAuth2 app-token flow; the token (~60 days) is reused across calls in this process.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
	if (cachedToken && cachedToken.expiresAt > Date.now())
		return cachedToken.value;

	const params = new URLSearchParams({
		client_id: process.env.IGDB_CLIENT_ID!,
		client_secret: process.env.IGDB_CLIENT_SECRET!,
		grant_type: "client_credentials",
	});
	const res = await fetch(`${TWITCH_TOKEN_URL}?${params}`, { method: "POST" });
	if (!res.ok) {
		throw new Error(`IGDB auth failed: ${await res.text()}`);
	}

	const json = await res.json();
	cachedToken = {
		value: json.access_token,
		// Refresh a minute early rather than risk a request straddling expiry.
		expiresAt: Date.now() + json.expires_in * 1000 - 60_000,
	};
	return cachedToken.value;
}

// IGDB enforces ~4 req/s per app; paced here, and a 429 gets one retry (see rate-limited-fetch.ts).
const limiter = createRateLimiter({ minIntervalMs: 250 });

async function igdbFetch(
	endpoint: string,
	body: string,
	signal?: AbortSignal,
): Promise<unknown> {
	const token = await getAccessToken();

	const res = await limiter.fetch(`${IGDB_BASE}/${endpoint}`, {
		method: "POST",
		headers: new Headers({
			"Client-ID": process.env.IGDB_CLIENT_ID!,
			Authorization: `Bearer ${token}`,
			Accept: "application/json",
		}),
		body,
		...(signal ? { signal } : {}),
	});

	if (!res.ok) {
		throw new Error(`IGDB request failed (${res.status}): ${await res.text()}`);
	}

	return res.json();
}

// Exercises the full pipeline (Twitch OAuth + an IGDB query) so any failure mode resolves to false.
export async function isIgdbReachable(): Promise<boolean> {
	try {
		await igdbFetch("games", "fields id; limit 1;", AbortSignal.timeout(5000));
		return true;
	} catch {
		return false;
	}
}

export async function fetchIgdbGameById(id: string): Promise<IgdbGame> {
	if (!/^\d+$/.test(id)) {
		throw new Error(`fetchIgdbGameById: expected a numeric id, got "${id}"`);
	}

	const json = await cachedJson("igdb", `game-${id}`, () =>
		igdbFetch("games", `fields ${GAME_FIELDS}; where id = ${id};`),
	);
	const games = parseOrThrow(IgdbGamesResponseSchema, json);
	const game = games[0];
	if (!game) throw new Error(`IGDB: no game found for id ${id}`);
	return game;
}

// Apicalypse bodies are plain text; the search term is embedded in a quoted string, so quotes/backslashes
// must be escaped to prevent breaking out of it or injecting query clauses.
function escapeApicalypseString(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function searchIgdbGames(
	query: string,
): Promise<IgdbGameSearchResult[]> {
	const json = await igdbFetch(
		"games",
		`search "${escapeApicalypseString(query)}"; fields name, first_release_date, cover.image_id; limit 20;`,
	);
	return parseOrThrow(IgdbGameSearchResponseSchema, json);
}

// Matches the banner's fixed 16:9 display box (media-detail.module.sass's .banner); the ratio matters, not the resolution.
const TARGET_ASPECT_RATIO = 16 / 9;

// object-fit: cover crops narrower-than-16:9 sources much harder than wider ones, so narrow misses
// are penalized more heavily — equal distance from the target ratio isn't equal actual cropping.
const NARROW_PENALTY_MULTIPLIER = 3;

// IGDB has no relevance/vote signal like TMDB's vote_average, so closest-to-16:9 is the best proxy.
// Exported so the manual picker (getAlternativeBanners) can sort by the same metric.
export function artworkAspectRatioDiff(artwork: {
	width: number;
	height: number;
}): number {
	const diff = artwork.width / artwork.height - TARGET_ASPECT_RATIO;
	return diff < 0 ? Math.abs(diff) * NARROW_PENALTY_MULTIPLIER : diff;
}

// Artwork missing width/height (IGDB still processing it) can't be scored, so it's excluded here.
export function artworksWithDimensions(
	artworks: NonNullable<IgdbGame["artworks"]>,
): { image_id: string; width: number; height: number }[] {
	return artworks.filter(
		(a): a is { image_id: string; width: number; height: number } =>
			a.width !== undefined && a.height !== undefined,
	);
}

export function pickBestArtwork(
	artworks: NonNullable<IgdbGame["artworks"]>,
): string | null {
	const scorable = artworksWithDimensions(artworks);
	if (scorable.length === 0) return null;
	return scorable.reduce((best, artwork) =>
		artworkAspectRatioDiff(artwork) < artworkAspectRatioDiff(best)
			? artwork
			: best,
	).image_id;
}

export type IgdbCoverOption = { imageId: string; label: string };

// IGDB models one Cover per Game; region-specific box art (IGDB.com's "cover" gallery) lives in
// game_localizations instead, unreachable from the game object, so it's queried separately and merged in.
export async function fetchIgdbGameCoverOptions(
	gameId: string,
): Promise<IgdbCoverOption[]> {
	if (!/^\d+$/.test(gameId)) {
		throw new Error(
			`fetchIgdbGameCoverOptions: expected a numeric id, got "${gameId}"`,
		);
	}

	const [coverJson, localizationJson] = await Promise.all([
		igdbFetch("covers", `fields image_id; where game = ${gameId};`),
		igdbFetch(
			"game_localizations",
			`fields cover.image_id, region.name; where game = ${gameId} & cover != null; limit 50;`,
		),
	]);

	const covers = parseOrThrow(IgdbCoverListSchema, coverJson);
	const localizations = parseOrThrow(
		IgdbGameLocalizationListSchema,
		localizationJson,
	);

	const options: IgdbCoverOption[] = covers.map((cover) => ({
		imageId: cover.image_id,
		label: "Default",
	}));
	for (const localization of localizations) {
		if (!localization.cover) continue;
		options.push({
			imageId: localization.cover.image_id,
			label: localization.region?.name ?? "Regional",
		});
	}
	return options;
}
