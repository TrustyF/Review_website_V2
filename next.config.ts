import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
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
		// Setting localPatterns at all switches next/image to an explicit
		// allowlist for every local (same-origin) image path, not just ones
		// with a query string — so the real cached posters need listing here
		// too, alongside the picker-preview proxy endpoint.
		localPatterns: [
			{
				pathname: "/posters/cache/**",
			},
			{
				pathname: "/banners/cache/**",
			},
			{
				pathname: "/posters/changelog-cache/**",
			},
			{
				pathname: "/banners/changelog-cache/**",
			},
			{
				pathname: "/posters/placeholder.jpg",
			},
			{
				pathname: "/api/image-proxy/**",
			},
			{
				pathname: "/api/poster/**",
			},
			{
				pathname: "/api/banner/**",
			},
		],
		// Only reachable when IMAGE_STORAGE_DRIVER=vercel-blob — resolveChangelogPosterThumb/
		// resolveChangelogBannerThumb and saveListThumbnail/cropAndSave (see
		// src/server/storage/image-storage.ts's VercelBlobImageStorage) hand
		// out a direct https://<storeId>.public.blob.vercel-storage.com/...
		// URL instead of a local path in that mode, so next/image needs this
		// allowlisted alongside localPatterns above. Harmless to leave enabled
		// under the local driver — it just never matches anything.
		remotePatterns: [
			{
				protocol: "https",
				hostname: "*.public.blob.vercel-storage.com",
			},
		],
	},
};

export default nextConfig;
