// Hardcoded: consumers (sitemap.ts, robots.ts) are statically generated at
// `docker build` time, before SITE_URL is injected (only at container runtime).
export const SITE_URL = "https://review.arthursirjacobs.com";
