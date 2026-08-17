import { MediaStatus, Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
	connectionString: process.env.DATABASE_URL!,
	// Default pg.Pool max is 10 — fine for normal app traffic, but enrich-db's
	// GLOBAL_DB_CONCURRENCY (maintenance/enrich-db.ts) needs enough slots to
	// actually run that many transactions at once instead of queuing for a
	// pool connection on top of already queuing for Neon's own network
	// latency. DATABASE_URL is expected to be Neon's pooled (PgBouncer)
	// endpoint (see .env.example), which multiplexes far more than this
	// itself, so raising it here doesn't push load onto Neon directly. Kept
	// well under Neon's own direct-connection ceiling (115 on this project's
	// plan, per its dashboard) to leave room for the live app, Prisma
	// Studio, etc. running against the same DB at the same time.
	max: 60,
});

export const db = new PrismaClient({
	adapter,
	// Prisma's 5s/2s defaults assume near-zero round-trip latency — true
	// enough against local Postgres, but every ingest module (movie.ts,
	// tv-show.ts, comic.ts, game.ts, manga.ts, book.ts) runs one sequential
	// query per cast/crew/genre/company inside a single interactive
	// transaction (see entity-resolver.ts's resolve* upserts), and a big
	// ensemble cast times out against a remote DB like Neon where each round
	// trip costs real network latency. Applies globally rather than patching
	// all 14 $transaction call sites individually.
	transactionOptions: {
		timeout: 60_000, // default: 5_000ms — the transaction body itself; a movie with a large cast/crew (100+ sequential round trips) can still take tens of seconds over the network
		maxWait: 10_000, // default: 2_000ms — time to acquire a connection/transaction slot, generous enough to ride out a Neon cold-start
	},
});

// Merges isDeleted: false into a Media `where`, but only when the caller
// hasn't already said anything about that field — an explicit isDeleted
// (true or false, e.g. a maintenance query that wants both) always wins, so
// this never fights a query that means to see soft-deleted rows too. Typed
// loosely on purpose (every findMany/findFirst/findUnique/count `where`
// shape is structurally close enough) — callers cast the result back to
// whatever Prisma's generated arg type actually wants.
function excludeDeleted(
	where: Record<string, unknown> | undefined,
): Record<string, unknown> {
	if (where && "isDeleted" in where && where.isDeleted !== undefined) {
		return where;
	}
	return { ...where, isDeleted: false };
}

// Same "merge in unless the caller already said something about this field"
// pattern as excludeDeleted above — a caller that explicitly filters on
// `status` (e.g. the home page's "Anticipated releases" section, which wants
// exactly the ANNOUNCED/UPCOMING rows this would otherwise hide) always wins.
// Everywhere else, unreleased media (announced or upcoming, i.e. not yet out)
// stays out of public listings/search by default so it doesn't show up
// looking like a normal released title with just a future date.
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

// For public-facing reads only — every page a visitor can actually browse to
// (home, per-type lists, ...) should query through this instead of the raw
// `db`, so a newly added list page can't forget to hide soft-deleted media
// the way every one of them originally did (see the isDeleted field on
// Media in schema/media.prisma).
//
// Only covers *top-level* Media queries. Prisma extensions don't run for
// nested reads pulled in through include/select on another model (e.g.
// credit-media-list-page.tsx's `db.credit.findMany({ include: { media:
// {...} } })`) — those still need `isDeleted: false` written out by hand;
// see https://github.com/prisma/prisma/issues/24525. Anything that
// legitimately needs to see soft-deleted rows (the editor's own actions,
// the detail page so it can offer a restore, maintenance scripts) should
// keep using `db` directly, not this.
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
