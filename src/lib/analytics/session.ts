const ANALYTICS_SERVER_URL = "https://analytics.arthursirjacobs.com";

export type Geo = Record<string, unknown> | null;

let sessionSeed: string | null = null;

export function getSessionSeed(): string {
	if (sessionSeed) return sessionSeed;

	sessionSeed = sessionStorage.getItem("review_website_sid");
	if (!sessionSeed) {
		sessionSeed = `${crypto.randomUUID()}review-website`;
		sessionStorage.setItem("review_website_sid", sessionSeed);
	}

	return sessionSeed;
}

// Called lazily from the client-only rrweb start() path, never at module
// scope — a top-level call here would also fire during Next's SSR pass.
export async function fetchGeo(): Promise<Geo> {
	const ip = await fetch("https://api.ipify.org?format=json")
		.then((res) => res.json())
		.then((data) => data.ip as string)
		.catch(() => null);

	if (!ip) return null;

	return fetch(
		`${ANALYTICS_SERVER_URL}/api/session/geo_locate?ip=${encodeURIComponent(ip)}`,
	)
		.then((res) => res.json())
		.catch(() => null);
}
