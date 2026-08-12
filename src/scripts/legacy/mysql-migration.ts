// migrate.ts
import mysql, { RowDataPacket } from "mysql2/promise";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { MediaType } from "@prisma/client";

const mediaTypeMap: Record<string, MediaType> = {
	movie: MediaType.MOVIE,
	short: MediaType.SHORT,
	tv: MediaType.TVSHOW,
	manga: MediaType.MANGA,
	comic: MediaType.COMIC,
	game: MediaType.GAME,
};

export function toMediaType(value: string): MediaType | undefined {
	const mapped = mediaTypeMap[value.toLowerCase().trim()];
	if (!mapped) {
		console.log(`Unknown media type: ${value}`);
		return undefined;
	}
	return mapped;
}

const adapter = new PrismaPg({
	connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

// Shape of a row coming out of the OLD schema
interface LegacyUserRow extends RowDataPacket {
	id: number;
	name: string;
	type: string;
	myRating: number;
	isDropped: boolean;
	isDeleted: boolean;
	createDate: Date;
	updateDate: Date;
	externalId: number;
	difficulty: number | null;
}

async function main() {
	//Connect to the OLD db directly
	const oldDb = await mysql.createConnection({
		host: "localhost",
		port: 3306,
		user: "root",
		password: process.env.OLD_DB_PASSWORD!,
		database: "trustyfox$review_site",
	});

	//  Pull rows from the old schema
	const [oldMedia] = await oldDb.execute<LegacyUserRow[]>(
		"SELECT * FROM Medias",
	);

	// Transform old rows into a flat intermediate shape rather than Prisma's
	// nested MediaCreateInput — createManyAndReturn (used below to batch the
	// actual inserts) can't express a nested `movie: { create: {} }`/
	// `review: { create: {...} }` the way media.create() could, so the child-
	// table row and review are tracked alongside instead of nested inside.
	type TransformedItem = {
		title: string;
		type: MediaType;
		isDeleted: boolean;
		createDate: Date;
		updateDate: Date;
		externalId: string | null;
		review: { rating: number; difficulty: number | null; createDate: Date } | null;
	};
	const transformed: TransformedItem[] = [];

	// loop entries
	for (const u of oldMedia.slice(0)) {
		const mediaType = toMediaType(u.media_type);

		// Skip not found
		if (mediaType == undefined) continue;

		transformed.push({
			title: u.name,
			type: mediaType,
			isDeleted: Boolean(u.is_deleted),
			createDate: u.created_at,
			updateDate: u.updated_at,
			externalId: u.external_id,
			review:
				u.user_rating != null
					? {
							rating: u.user_rating ?? 0,
							// Old schema's scale is one higher than the new one (see
							// Review.difficulty in prisma/schema/rating.prisma) — shift
							// down so it lands on the same none/medium/hard meaning.
							difficulty: u.difficulty != null ? u.difficulty - 1 : null,
							// Otherwise defaults to now() (see Review.createDate in
							// rating.prisma) — "Watched on" would read as the moment
							// this migration ran instead of the actual old date. The
							// old schema never split "added to the catalog" from
							// "watched/rated" into two dates the way Media.createDate/
							// Review.createDate do now, so this reuses the same
							// created_at the Media row above it does.
							createDate: u.created_at,
						}
					: null,
		});
	}

	// Media has no unique constraint (see prisma/schema/media.prisma) beyond
	// its own id, so inserting a row here never rejects a duplicate on its
	// own — re-running this script (e.g. after fixing a mediaTypeMap gap)
	// would otherwise insert a second copy of every row already migrated in
	// a prior run. One upfront query for every (type, externalId) pair
	// already in Neon, instead of one findFirst() per old row (1721 round
	// trips became 1) — makes the whole script safe to re-run any number of
	// times, same guarantee as before, just batched.
	const existing = await db.media.findMany({
		select: { type: true, externalId: true },
	});
	const existingKeys = new Set(
		existing.map((m) => `${m.type}:${m.externalId ?? ""}`),
	);
	const newItems = transformed.filter(
		(item) => !existingKeys.has(`${item.type}:${item.externalId ?? ""}`),
	);

	console.log(
		`${transformed.length} mapped rows, ${newItems.length} not yet migrated.`,
	);
	if (newItems.length === 0) {
		await oldDb.end();
		return;
	}

	// Every type-specific child table (Movie/TvShow/Manga/Game/Comic) is
	// created empty — enrich_db fills in the real fields later, this
	// migration only needs the row to exist — so batching it is just a
	// grouped createMany per table keyed on the freshly-created mediaID.
	const CHILD_TABLE_BY_TYPE = {
		[MediaType.MOVIE]: "movie",
		[MediaType.TVSHOW]: "tvShow",
		[MediaType.MANGA]: "manga",
		[MediaType.GAME]: "game",
		[MediaType.COMIC]: "comic",
	} as const;
	type ChildTable = (typeof CHILD_TABLE_BY_TYPE)[keyof typeof CHILD_TABLE_BY_TYPE];

	// One transaction for the whole batch — a Media row created without its
	// child row (if a later step in this same batch failed) would be an
	// orphan the idempotency check above can't detect on a re-run, since it
	// only verifies the Media row exists, not its child/review rows. Wrapping
	// everything together means a failure rolls the whole batch back instead
	// of leaving that half-written state. Each createMany runs sequentially
	// against the shared transaction client rather than concurrently
	// (Promise.all) — issuing concurrent queries against one interactive
	// transaction's session is exactly the pattern that produced the empty-
	// upsert-result bug resolveRole hit earlier; sequential avoids that
	// class of problem entirely, and six extra round trips is negligible
	// next to the 1721 this replaced.
	const created = await db.$transaction(async (tx) => {
		// createManyAndReturn (rather than createMany, which returns only a
		// count) hands back every inserted row in the same order as `data`
		// was given — Prisma guarantees this ordering — so `rows[i]` is
		// newItems[i]'s row without needing a second query or a (type,
		// externalId) re-match, which the one old row with a null externalId
		// would otherwise make ambiguous.
		const rows = await tx.media.createManyAndReturn({
			data: newItems.map((item) => ({
				title: item.title,
				type: item.type,
				isDeleted: item.isDeleted,
				createDate: item.createDate,
				updateDate: item.updateDate,
				externalId: item.externalId,
			})),
			select: { id: true },
		});

		const childRows: Record<ChildTable, { mediaID: number }[]> = {
			movie: [],
			tvShow: [],
			manga: [],
			game: [],
			comic: [],
		};
		const reviewRows: Prisma.ReviewCreateManyInput[] = [];

		newItems.forEach((item, i) => {
			const mediaID = rows[i]!.id;

			const table =
				CHILD_TABLE_BY_TYPE[item.type as keyof typeof CHILD_TABLE_BY_TYPE];
			if (table) childRows[table].push({ mediaID });

			if (item.review) {
				reviewRows.push({ mediaId: mediaID, ...item.review });
			}
		});

		if (childRows.movie.length) {
			await tx.movie.createMany({ data: childRows.movie });
		}
		if (childRows.tvShow.length) {
			await tx.tvShow.createMany({ data: childRows.tvShow });
		}
		if (childRows.manga.length) {
			await tx.manga.createMany({ data: childRows.manga });
		}
		if (childRows.game.length) {
			await tx.game.createMany({ data: childRows.game });
		}
		if (childRows.comic.length) {
			await tx.comic.createMany({ data: childRows.comic });
		}
		if (reviewRows.length) {
			await tx.review.createMany({ data: reviewRows });
		}

		return rows;
	});

	console.log(`Inserted ${created.length} new media rows.`);

	await oldDb.end();
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
