import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
	schema: "prisma/schema",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		// The CLI (migrate/studio/generate) connects with this, separately
		// from the app's own runtime connection in src/server/db/client.ts —
		// the two are free to point at different URLs. That matters once
		// DATABASE_URL is a pooled connection string (e.g. Neon's PgBouncer
		// endpoint): pooled connections work fine for the app's ordinary
		// queries, but `prisma migrate deploy`'s advisory-lock-based
		// migration lock needs a real session-level connection, which
		// transaction-mode pooling doesn't reliably provide. DIRECT_URL (the
		// provider's unpooled connection string) is optional — falls back to
		// DATABASE_URL when unset, which is exactly right for local dev
		// where there's no pooler in front of DATABASE_URL to begin with.
		url: process.env.DIRECT_URL || env("DATABASE_URL"),
	},
});
