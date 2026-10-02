import { createHash } from "crypto";
import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

// Function form so the build time is stamped only during `next build` (not in the npm
// script, which broke on Windows); `next dev` leaves it unset so the badge shows "dev".
export default function config(phase: string): NextConfig {
	const buildTime =
		process.env.NEXT_PUBLIC_BUILD_TIME ??
		(phase === PHASE_PRODUCTION_BUILD
			? `${new Date().toISOString().slice(0, 19)}Z`
			: undefined);

	return {
		/* config options here */
		// Self-hosted uses traced standalone bundle (no-op for Vercel).
		output: "standalone",
		reactCompiler: true,
		// Prevents version-skew bugs: stale tabs detect new builds via hashed BUILD_TIME.
		// Conditional spread omits keys for local `next dev` (no build time).
		...(buildTime
			? {
					env: { NEXT_PUBLIC_BUILD_TIME: buildTime },
					deploymentId: createHash("sha256")
						.update(buildTime)
						.digest("hex")
						.slice(0, 16),
				}
			: {}),
		experimental: {
			serverActions: {
				// 1MB default too small; raw source must survive trip before compression
				bodySizeLimit: "10mb",
			},
			// Keeps visited list page's instance alive instead of remounting on back/forward nav. Without this, dynamic routes default to 0s staleTime, breaking scroll restoration.
			staleTimes: {
				dynamic: 180,
			},
		},
		images: {
			// Posters/banners pre-resized server-side; disabling Vercel's
			// optimizer avoids redundant work and pattern-allowlist need.
			unoptimized: true,
		},
		allowedDevOrigins: ["192.168.1.68"],
		async headers() {
			// @font-face requires CORS even for plain cross-origin loads, unlike
			// images/CSS - needed for the rrweb replay on analytics.arthursirjacobs.com.
			return [
				{
					source: "/_next/static/:path*",
					headers: [
						{
							key: "Access-Control-Allow-Origin",
							value: "https://analytics.arthursirjacobs.com",
						},
					],
				},
			];
		},
	};
}
