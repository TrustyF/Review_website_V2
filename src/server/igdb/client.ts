import {
	IgdbGame,
	IgdbGamesResponseSchema,
	IgdbGameSearchResponseSchema,
	IgdbGameSearchResult,
} from "./schema";
import { parseOrThrow } from "@/lib/arktype/parse-or-throw";

const IGDB_BASE = "https://api.igdb.com/v4";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";

const GAME_FIELDS = [
	"name",
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
	if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

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

export async function fetchIgdbGameById(id: string): Promise<IgdbGame> {
	if (!/^\d+$/.test(id)) {
		throw new Error(`fetchIgdbGameById: expected a numeric id, got "${id}"`);
	}

	const token = await getAccessToken();
	const res = await fetch(`${IGDB_BASE}/games`, {
		method: "POST",
		headers: new Headers({
			"Client-ID": process.env.IGDB_CLIENT_ID!,
			Authorization: `Bearer ${token}`,
			Accept: "application/json",
		}),
		body: `fields ${GAME_FIELDS}; where id = ${id};`,
	});

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(`IGDB fetch failed for game ${id} : ${errorText}`);
	}

	const json = await res.json();
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

export async function searchIgdbGames(query: string): Promise<IgdbGameSearchResult[]> {
	const token = await getAccessToken();
	const res = await fetch(`${IGDB_BASE}/games`, {
		method: "POST",
		headers: new Headers({
			"Client-ID": process.env.IGDB_CLIENT_ID!,
			Authorization: `Bearer ${token}`,
			Accept: "application/json",
		}),
		body: `search "${escapeApicalypseString(query)}"; fields name, first_release_date, cover.image_id; limit 20;`,
	});

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(`IGDB search failed for "${query}" : ${errorText}`);
	}

	const json = await res.json();
	return parseOrThrow(IgdbGameSearchResponseSchema, json);
}
