import {
	GoogleBooksSearchResponseSchema,
	GoogleBooksVolume,
	GoogleBooksVolumeSchema,
} from "./schema";
import { parseOrThrow } from "@/lib/arktype/parse-or-throw";
import { createRateLimiter } from "@/server/lib/rate-limited-fetch";

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1";

// No documented per-second limit (quota is daily) — light defensive spacing
// for consistency with the other sources rather than a response to a known
// constraint.
const limiter = createRateLimiter({ minIntervalMs: 100 });

function apiKey(): string {
	const key = process.env.GOOGLE_BOOKS_API_KEY;
	if (!key) throw new Error("Missing GOOGLE_BOOKS_API_KEY env var");
	return key;
}

async function googleBooksFetch(url: URL): Promise<unknown> {
	const res = await limiter.fetch(url);
	if (!res.ok) {
		throw new Error(`Google Books request failed (${res.status}): ${url}`);
	}
	return res.json();
}

export async function fetchGoogleBooksById(id: string): Promise<GoogleBooksVolume> {
	const url = new URL(`${GOOGLE_BOOKS_BASE}/volumes/${id}`);
	url.searchParams.set("key", apiKey());

	const json = await googleBooksFetch(url);
	return parseOrThrow(GoogleBooksVolumeSchema, json);
}

export async function searchGoogleBooks(
	query: string,
): Promise<GoogleBooksVolume[]> {
	const url = new URL(`${GOOGLE_BOOKS_BASE}/volumes`);
	url.searchParams.set("key", apiKey());
	url.searchParams.set("q", query);
	url.searchParams.set("maxResults", "20");

	const json = await googleBooksFetch(url);
	const parsed = parseOrThrow(GoogleBooksSearchResponseSchema, json);
	return parsed.items ?? [];
}
