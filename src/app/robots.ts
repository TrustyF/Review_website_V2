import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
			// Auth-gated/private routes — nothing there for search engines to index.
			disallow: [
				"/account",
				"/admin",
				"/dev",
				"/login",
				"/signup",
				"/onboarding",
				"/api",
			],
		},
		sitemap: `${SITE_URL}/sitemap.xml`,
	};
}
