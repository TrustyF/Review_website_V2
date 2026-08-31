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

	// Flat intermediate shape, not Prisma's nested MediaCreateInput —
	// createManyAndReturn (used below to batch inserts) can't express nested creates.
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
							// Old schema's scale is one higher than the new one — shift
							// down so it lands on the same none/medium/hard meaning.
							difficulty: u.difficulty != null ? u.difficulty - 1 : null,
							// Reuse created_at, else this would default to now() and
							// "Watched on" would read as the migration run time.
							createDate: u.created_at,
						}
					: null,
		});
	}

	// Media has no unique constraint beyond id, so re-running this script
	// would insert duplicates without this check. One upfront query for
	// every existing (type, externalId) pair instead of 1721 findFirst() calls.
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

	// Child tables are created empty — enrich_db fills real fields later,
	// this migration only needs the row to exist.
	const CHILD_TABLE_BY_TYPE = {
		[MediaType.MOVIE]: "movie",
		[MediaType.TVSHOW]: "tvShow",
		[MediaType.MANGA]: "manga",
		[MediaType.GAME]: "game",
		[MediaType.COMIC]: "comic",
	} as const;
	type ChildTable = (typeof CHILD_TABLE_BY_TYPE)[keyof typeof CHILD_TABLE_BY_TYPE];

	// One transaction for the whole batch — a Media row without its child
	// row would be an orphan the idempotency check can't detect on a re-run.
	// Sequential createMany calls, not Promise.all: concurrent queries on
	// one interactive transaction session caused a bug before (empty upsert
	// results); the extra round trips are negligible here.
	const created = await db.$transaction(async (tx) => {
		// createManyAndReturn preserves `data` order (Prisma guarantee), so
		// rows[i] is newItems[i] without a re-match, which a null externalId would otherwise make ambiguous.
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
