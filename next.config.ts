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
			{
				pathname: "/ui/**",
			},
		],
		// Only reachable when getImageStorage() selects the R2 driver —
		// resolveChangelogPosterThumb/resolveChangelogBannerThumb and
		// saveListThumbnail/cropAndSave (see src/server/storage/image-storage.ts)
		// hand out a direct object-store URL instead of a local path in that
		// mode, so next/image needs it allowlisted alongside localPatterns
		// above. Harmless to leave both enabled under the local driver — they
		// just never match anything. R2_PUBLIC_URL's host is read here rather
		// than hardcoded because it's either a per-bucket *.r2.dev host or a
		// custom domain, chosen when the bucket's public access is enabled.
		remotePatterns: [
			{
				protocol: "https",
				hostname: "*.public.blob.vercel-storage.com",
			},
			...(process.env.R2_PUBLIC_URL
				? [
						{
							protocol: new URL(process.env.R2_PUBLIC_URL).protocol.replace(
								":",
								"",
							) as "http" | "https",
							hostname: new URL(process.env.R2_PUBLIC_URL).hostname,
						},
					]
				: []),
		],
	},
};

export default nextConfig;
