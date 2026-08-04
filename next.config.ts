import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	reactCompiler: true,
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
				pathname: "/posters/placeholder.jpg",
			},
			{
				pathname: "/api/image-proxy/**",
			},
		],
	},
};

export default nextConfig;
