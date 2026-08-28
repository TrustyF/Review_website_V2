import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	// Self-hosted deployments (see the ThinkCentre migration plan) run the
	// traced standalone server bundle rather than `next start` against the
	// full node_modules tree — this is a no-op for Vercel's own build.
	output: "standalone",
	reactCompiler: true,
	experimental: {
		serverActions: {
			// Default 1MB cap is too small for uploadListThumbnail's raw source
			// image (see list-thumbnail-resolver.ts) — sharp compresses it down
			// server-side, but the original file still has to survive the trip
			// there first.
			bodySizeLimit: "10mb",
		},
		// Keeps a visited list page's client-side instance (and with it,
		// LazyMediaGrid's already-expanded card count + scroll position)
		// alive for a few minutes instead of remounting from scratch on
		// back/forward nav. Without this, dynamic routes default to a 0s
		// staleTime, so LazyMediaGrid always remounts back at its initial
		// batch — a shorter page than the one the user scrolled on, which
		// is what breaks the browser's scroll restoration. Mutations
		// already call revalidatePath/router.refresh() (see change-log,
		// media-editor, media-add actions), so this doesn't risk showing
		// stale data after an edit.
		staleTimes: {
			dynamic: 180,
		},
	},
	images: {
		// Every poster/banner src is already resized + re-encoded server-side
		// before it ever reaches R2 or local disk cache (see poster-resolver.ts,
		// image-storage.ts) — Vercel's Image Optimization would just redo that
		// work against a cold, slow route, and each distinct src (posters/
		// banners are content-addressed, so history keeps minting new ones —
		// see change-log-list.tsx) permanently counts against the plan's
		// transformation quota. Disabling it here serves every src as-is, and
		// means next/image no longer needs a local/remote pattern allowlist
		// (that only gated what the optimizer could fetch).
		unoptimized: true,
	},
};

export default nextConfig;
