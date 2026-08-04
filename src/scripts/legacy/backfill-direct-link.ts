import mysql, { RowDataPacket } from "mysql2/promise";
import "dotenv/config";
import { db } from "@/server/db/client";
import { MediaType } from "@prisma/client";

// One-time backfill: the old DB had a video_link field the original
// mysql-migration never carried over (Media.directLink has sat unused ever
// since). Only movie/tv rows are handled here — the other 273 old rows with
// a video_link are all media_type "youtube", a category the original
// migration also never mapped, so those rows don't exist in the new DB at
// all and are left alone rather than guessed at.
//
// Deliberately not reusing mysql-migration.ts's toMediaType: that module
// runs its own main() unconditionally at load time, so importing anything
// from it would silently re-run the entire original migration.
//
// The old schema has no SHORT distinction (only "movie"/"tv"/...), but the
// new one does — some old media_type:"movie" rows now live as SHORT here,
// reclassified sometime after the original migration. Try MOVIE first, then
// SHORT, rather than only ever matching the old type literally.
const CANDIDATE_TYPES: Record<string, MediaType[]> = {
	movie: [MediaType.MOVIE, MediaType.SHORT],
	tv: [MediaType.TVSHOW],
};

interface LegacyVideoLinkRow extends RowDataPacket {
	id: number;
	name: string;
	media_type: string;
	external_id: string;
	video_link: string;
}

async function main() {
	const oldDb = await mysql.createConnection({
		host: "localhost",
		port: 3306,
		user: "root",
		password: process.env.OLD_DB_PASSWORD!,
		database: "trustyfox$review_site",
	});

	const [rows] = await oldDb.execute<LegacyVideoLinkRow[]>(
		`SELECT id, name, media_type, external_id, video_link
		 FROM Medias
		 WHERE media_type IN ('movie', 'tv')
		   AND video_link IS NOT NULL AND video_link != ''`,
	);

	let updated = 0;
	let missing = 0;
	for (const row of rows) {
		const types = CANDIDATE_TYPES[row.media_type.toLowerCase().trim()];
		if (!types) continue;

		const media = await db.media.findFirst({
			where: { externalId: String(row.external_id), type: { in: types } },
		});
		if (!media) {
			console.log(
				`No match for "${row.name}" (${row.media_type}, externalId ${row.external_id})`,
			);
			missing++;
			continue;
		}

		await db.media.update({
			where: { id: media.id },
			data: { directLink: row.video_link },
		});
		updated++;
	}

	console.log(
		`Backfilled directLink for ${updated}/${rows.length} rows (${missing} unmatched)`,
	);

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
