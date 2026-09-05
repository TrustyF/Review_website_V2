// Generic proxy for remote URLs from allowlisted hosts; base64url-encoded in path

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
