import { MediaStatus, Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
	connectionString: process.env.DATABASE_URL!,
	// Default pg.Pool max of 10 can't keep up with enrich-db's GLOBAL_DB_CONCURRENCY; kept under Postgres's max_connections (100) to leave room for other services.
	max: 60,
});

export const db = new PrismaClient({
	adapter,
	// Prisma's 5s/2s defaults are too tight for ingest transactions doing many sequential per-cast/crew round trips; set globally rather than patching every $transaction call site.
	transactionOptions: {
		timeout: 60_000, // default 5_000ms — large casts can take tens of seconds of sequential round trips
		maxWait: 10_000, // default 2_000ms — time to acquire a connection slot
	},
});

// Merges isDeleted: false in unless the caller already filters on it explicitly. Typed loosely; callers cast back to Prisma's generated arg type.
function excludeDeleted(
	where: Record<string, unknown> | undefined,
): Record<string, unknown> {
	if (where && "isDeleted" in where && where.isDeleted !== undefined) {
		return where;
	}
	return { ...where, isDeleted: false };
}

// Same merge-unless-explicit pattern as excludeDeleted: hides unreleased (announced/upcoming) media from public listings by default.
const UNRELEASED_STATUSES: MediaStatus[] = [
	MediaStatus.ANNOUNCED,
	MediaStatus.UPCOMING,
];
function excludeUnreleased(
	where: Record<string, unknown> | undefined,
): Record<string, unknown> {
	if (where && "status" in where && where.status !== undefined) {
		return where;
	}
	return { ...where, status: { notIn: UNRELEASED_STATUSES } };
}

// Public-facing reads should query through this instead of raw `db` so new list pages can't forget to hide soft-deleted media.
// Only covers top-level Media queries — nested reads via include/select need `isDeleted: false` written by hand (Prisma extensions don't run there; prisma#24525).
export const dbPublic = db.$extends({
	name: "excludeSoftDeletedMedia",
	query: {
		media: {
			findMany({ args, query }) {
				args.where = excludeUnreleased(
					excludeDeleted(args.where),
				) as Prisma.MediaWhereInput;
				return query(args);
			},
			findFirst({ args, query }) {
				args.where = excludeUnreleased(
					excludeDeleted(args.where),
				) as Prisma.MediaWhereInput;
				return query(args);
			},
			findUnique({ args, query }) {
				args.where = excludeUnreleased(
					excludeDeleted(args.where),
				) as Prisma.MediaWhereUniqueInput;
				return query(args);
			},
			count({ args, query }) {
				args.where = excludeUnreleased(
					excludeDeleted(args.where),
				) as Prisma.MediaWhereInput;
				return query(args);
			},
		},
	},
});
