import mysql, { RowDataPacket } from "mysql2/promise";
import "dotenv/config";
import { db } from "@/server/db/client";
import { MediaType } from "@prisma/client";

// One-time backfill for video_link (movie/tv only, not "youtube" type).
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
