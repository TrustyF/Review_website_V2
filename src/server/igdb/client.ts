import {
	IgdbCoverListSchema,
	IgdbGame,
	IgdbGameLocalizationListSchema,
	IgdbGamesResponseSchema,
	IgdbGameSearchResponseSchema,
	IgdbGameSearchResult,
} from "./schema";
import { parseOrThrow } from "@/lib/arktype/parse-or-throw";

const IGDB_BASE = "https://api.igdb.com/v4";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";

const GAME_FIELDS = [
	"name",
	"url",
	"summary",
	"first_release_date",
	"total_rating",
	"status",
	"genres.name",
	"involved_companies.company.id",
	"involved_companies.company.name",
	"involved_companies.developer",
	"involved_companies.publisher",
	"cover.image_id",
	"platforms.name",
].join(", ");

// IGDB sits behind Twitch's OAuth2 app-token flow rather than a static key —
// the token is short-lived (~60 days) but reused across calls within this
// process instead of being fetched per-request.
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

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// IGDB enforces ~4 requests/second per app; a batch run (enrich-db) that
// fires requests back-to-back can trip that even though each individual
// call is well-formed. 429s are transient, so they're worth retrying with
// backoff rather than failing the row outright — everything else (4xx/5xx)
// still fails immediately since retrying won't fix those.
const MAX_ATTEMPTS = 5;

async function igdbFetch(endpoint: string, body: string): Promise<unknown> {
	const token = await getAccessToken();

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		const res = await fetch(`${IGDB_BASE}/${endpoint}`, {
			method: "POST",
			headers: new Headers({
				"Client-ID": process.env.IGDB_CLIENT_ID!,
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
			}),
			body,
		});

		if (res.status === 429) {
			if (attempt === MAX_ATTEMPTS) {
				throw new Error(`IGDB rate limited after ${MAX_ATTEMPTS} attempts`);
			}
			const retryAfter = Number(res.headers.get("Retry-After"));
			const delayMs =
				Number.isFinite(retryAfter) && retryAfter > 0
					? retryAfter * 1000
					: attempt * 500;
			await sleep(delayMs);
			continue;
		}

		if (!res.ok) {
			throw new Error(
				`IGDB request failed (${res.status}): ${await res.text()}`,
			);
		}

		return res.json();
	}

	// Unreachable — the loop above always either returns or throws.
	throw new Error("IGDB request failed: exhausted retry attempts");
}

export async function fetchIgdbGameById(id: string): Promise<IgdbGame> {
	if (!/^\d+$/.test(id)) {
		throw new Error(`fetchIgdbGameById: expected a numeric id, got "${id}"`);
	}

	const json = await igdbFetch(
		"games",
		`fields ${GAME_FIELDS}; where id = ${id};`,
	);
	const games = parseOrThrow(IgdbGamesResponseSchema, json);
	const game = games[0];
	if (!game) throw new Error(`IGDB: no game found for id ${id}`);
	return game;
}

// The Apicalypse body is plain text, not JSON — the search term gets
// embedded directly inside a quoted string in the query, so quotes/
// backslashes in it need escaping to keep it from breaking out of that
// string (or worse, injecting query clauses of its own).
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

export type IgdbCoverOption = { imageId: string; label: string };

// IGDB models exactly one Cover per Game — no alternate-cover-art gallery
// the way MangaDex/ComicVine have. What IGDB.com's own "cover" gallery
// actually shows is region-specific box art via game_localizations (e.g.
// Japan/Korea/Europe releases), which isn't reachable from the game object
// itself — has to be queried separately and combined with the default cover.
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
