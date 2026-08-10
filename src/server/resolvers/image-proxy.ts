// Generic reusable image proxy: given any remote URL from an allowlisted
// host, produces a same-origin path that streams it through our backend
// instead of hotlinking it directly. Some sources (TMDB) don't mind direct
// hotlinking, but others (MangaDex, for future manga support) reject it
// outright — routing everything through this proxy means callers never need
// to know or care which is which.
//
// The remote URL is base64url-encoded directly into the path (not a query
// string) so next/image's local-pattern matching only needs a plain
// pathname rule, no query-string allowlisting.

const ALLOWED_IMAGE_HOSTS = [
	"image.tmdb.org",
	"uploads.mangadex.org",
	"images.igdb.com",
	"comicvine.gamespot.com",
	"books.google.com",
];

export function buildProxiedImageUrl(remoteUrl: string): string {
	const token = Buffer.from(remoteUrl, "utf-8").toString("base64url");
	return `/api/image-proxy/${token}`;
}

export function resolveProxiedImageUrl(token: string): URL {
	let url: URL;
	try {
		url = new URL(Buffer.from(token, "base64url").toString("utf-8"));
	} catch {
		throw new Error("Malformed image proxy token");
	}

	if (!ALLOWED_IMAGE_HOSTS.includes(url.hostname)) {
		throw new Error(`Image host not allowlisted: ${url.hostname}`);
	}

	return url;
}
