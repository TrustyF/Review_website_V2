import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
	schema: "prisma/schema",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		// CLI uses separate connection (optional DIRECT_URL) for migrations requiring real sessions.
		// Falls back to DATABASE_URL when unset, right for local dev.
		url: process.env.DIRECT_URL || env("DATABASE_URL"),
	},
});
