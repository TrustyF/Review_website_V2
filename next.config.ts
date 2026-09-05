import { createHash } from "crypto";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
// Self-hosted uses traced standalone bundle (no-op for Vercel).
	output: "standalone",
	reactCompiler: true,
	// Prevents version-skew bugs: stale tabs detect new builds via hashed BUILD_TIME.
	// Conditional spread omits key for local `next dev` (which has no env var).
	...(process.env.NEXT_PUBLIC_BUILD_TIME
		? {
				deploymentId: createHash("sha256")
					.update(process.env.NEXT_PUBLIC_BUILD_TIME)
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
};

export default nextConfig;
