import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { toAbsoluteUrl } from "@/server/lib/site-url";

const IMAGE_FETCH_TIMEOUT_MS = 15_000;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 3;

type FetchedImage = { bytes: Buffer; contentType: string };

async function readImage(res: Response, url: string): Promise<FetchedImage> {
	if (!res.ok) throw new Error(`Image download failed: ${url}`);
	if (Number(res.headers.get("content-length")) > MAX_IMAGE_BYTES) {
		throw new Error(`Image too large: ${url}`);
	}
	const bytes = Buffer.from(await res.arrayBuffer());
	if (bytes.length > MAX_IMAGE_BYTES) {
		throw new Error(`Image too large: ${url}`);
	}
	return {
		bytes,
		contentType: res.headers.get("content-type") || "image/jpeg",
	};
}

// Timeout + size cap: sources include arbitrary pasted URLs, fetched from public routes.
export async function fetchImage(url: string): Promise<FetchedImage> {
	const res = await fetch(url, {
		signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
	});
	return readImage(res, url);
}

const PRIVATE_RANGES = new BlockList();
for (const [net, prefix] of [
	["0.0.0.0", 8],
	["10.0.0.0", 8],
	["100.64.0.0", 10],
	["127.0.0.0", 8],
	["169.254.0.0", 16],
	["172.16.0.0", 12],
	["192.168.0.0", 16],
	["224.0.0.0", 3],
] as const) {
	PRIVATE_RANGES.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
	["::", 127], // unspecified + loopback
	["fc00::", 7],
	["fe80::", 10],
	["ff00::", 8],
] as const) {
	PRIVATE_RANGES.addSubnet(net, prefix, "ipv6");
}

async function assertPublicHttpUrl(url: URL): Promise<void> {
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error(`Unsupported image URL protocol: ${url.protocol}`);
	}
	const host = url.hostname.replace(/^\[|\]$/g, "");
	const addresses = isIP(host)
		? [{ address: host, family: isIP(host) }]
		: await lookup(host, { all: true });
	for (const { address, family } of addresses) {
		if (PRIVATE_RANGES.check(address, family === 6 ? "ipv6" : "ipv4")) {
			throw new Error(`Image host resolves to a private address: ${host}`);
		}
	}
}

// For user-pasted URLs: blocks private/internal hosts (SSRF), re-checking every redirect hop.
// Root-relative paths can only reach this app, so they skip the check.
export async function fetchUntrustedImage(raw: string): Promise<FetchedImage> {
	if (raw.startsWith("/") && !raw.startsWith("//")) {
		return fetchImage(toAbsoluteUrl(raw));
	}

	let url = new URL(raw);
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		await assertPublicHttpUrl(url);
		const res = await fetch(url, {
			redirect: "manual",
			signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
		});
		const location = res.headers.get("location");
		if (res.status >= 300 && res.status < 400 && location) {
			url = new URL(location, url);
			continue;
		}
		return readImage(res, raw);
	}
	throw new Error(`Too many redirects: ${raw}`);
}
