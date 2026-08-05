import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
	connectionString: process.env.DATABASE_URL!,
});

export const db = new PrismaClient({ adapter });

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
				args.where = excludeDeleted(args.where) as Prisma.MediaWhereInput;
				return query(args);
			},
			findFirst({ args, query }) {
				args.where = excludeDeleted(args.where) as Prisma.MediaWhereInput;
				return query(args);
			},
			findUnique({ args, query }) {
				args.where = excludeDeleted(
					args.where,
				) as Prisma.MediaWhereUniqueInput;
				return query(args);
			},
			count({ args, query }) {
				args.where = excludeDeleted(args.where) as Prisma.MediaWhereInput;
				return query(args);
			},
		},
	},
});
