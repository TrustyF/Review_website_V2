import {
	ComicVineIssue,
	ComicVineIssueSearchResponseSchema,
	ComicVineVolume,
	ComicVineVolumeResponseSchema,
	ComicVineVolumeSearchResponseSchema,
} from "./schema";
import { parseOrThrow } from "@/lib/arktype/parse-or-throw";
import { createRateLimiter } from "@/server/lib/rate-limited-fetch";

const COMICVINE_BASE = "https://comicvine.gamespot.com/api";

// ComicVine rejects requests with no User-Agent outright, and requires a
// stable one to keep from being rate-limited as a bot.
const USER_AGENT = "review-website-nextjs/1.0 (personal media tracker)";

// ComicVine's own guidance is ~1 request/second.
const limiter = createRateLimiter({ minIntervalMs: 1000 });

// Every "volume" (what this app tracks a comic as — a full series/run, not
// a single issue) is addressed by a resource-typed id: the 4050- prefix
// marks it as a volume specifically, distinct from e.g. 4040- for a person
// or 4010- for a publisher. Our stored externalId is only the bare numeric
// part, so the prefix is reconstructed on every request.
function volumeResourceId(id: string): string {
	return `4050-${id}`;
}

function apiKey(): string {
	const key = process.env.COMIC_VINE_KEY;
	if (!key) throw new Error("Missing COMIC_VINE_KEY env var");
	return key;
}

async function comicVineFetch(
	url: URL,
	signal?: AbortSignal,
): Promise<unknown> {
	const res = await limiter.fetch(url, {
		headers: new Headers({ "User-Agent": USER_AGENT }),
		...(signal ? { signal } : {}),
	});
	if (!res.ok) {
		throw new Error(`ComicVine request failed (${res.status}): ${url}`);
	}
	return res.json();
}

// ComicVine returns HTTP 200 even for a bad API key — the failure only shows
// up as status_code !== 1 in the body — so a plain res.ok check would miss a
// wrong/missing COMIC_VINE_KEY. This runs a real minimal query and checks
// that field directly.
export async function isComicVineReachable(): Promise<boolean> {
	try {
		const url = new URL(`${COMICVINE_BASE}/types/`);
		url.searchParams.set("api_key", apiKey());
		url.searchParams.set("format", "json");
		url.searchParams.set("limit", "1");

		const json = await comicVineFetch(url, AbortSignal.timeout(5000));
		return (json as { status_code?: number }).status_code === 1;
	} catch {
		return false;
	}
}

export async function fetchComicVineById(id: string): Promise<ComicVineVolume> {
	const url = new URL(`${COMICVINE_BASE}/volume/${volumeResourceId(id)}/`);
	url.searchParams.set("api_key", apiKey());
	url.searchParams.set("format", "json");

	const json = await comicVineFetch(url);
	const parsed = parseOrThrow(ComicVineVolumeResponseSchema, json);
	if (parsed.status_code !== 1) {
		throw new Error(
			`ComicVine: no volume found for id ${id} (${parsed.error})`,
		);
	}
	return parsed.results;
}

export async function searchComicVine(
	query: string,
): Promise<ComicVineVolume[]> {
	const url = new URL(`${COMICVINE_BASE}/volumes/`);
	url.searchParams.set("api_key", apiKey());
	url.searchParams.set("format", "json");
	url.searchParams.set("filter", `name:${query}`);
	url.searchParams.set("limit", "20");
	url.searchParams.set(
		"field_list",
		"id,name,start_year,image,publisher,count_of_issues",
	);

	const json = await comicVineFetch(url);
	const parsed = parseOrThrow(ComicVineVolumeSearchResponseSchema, json);
	if (parsed.status_code !== 1) {
		throw new Error(`ComicVine search failed for "${query}" (${parsed.error})`);
	}
	return parsed.results;
}

// filter=volume:<id> takes the bare numeric id, unlike the /volume/{id}/
// detail endpoint which needs the 4050- resource prefix.
export async function fetchComicVineIssuesForVolume(
	volumeId: string,
): Promise<ComicVineIssue[]> {
	const url = new URL(`${COMICVINE_BASE}/issues/`);
	url.searchParams.set("api_key", apiKey());
	url.searchParams.set("format", "json");
	url.searchParams.set("filter", `volume:${volumeId}`);
	url.searchParams.set("limit", "50");
	url.searchParams.set("field_list", "id,name,issue_number,image");

	const json = await comicVineFetch(url);
	const parsed = parseOrThrow(ComicVineIssueSearchResponseSchema, json);
	if (parsed.status_code !== 1) {
		throw new Error(
			`ComicVine: failed to list issues for volume ${volumeId} (${parsed.error})`,
		);
	}
	return parsed.results;
}
