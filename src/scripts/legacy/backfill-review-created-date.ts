import { db } from "@/server/db/client";

// One-time backfill: the legacy migration gave Review.createDate a fresh
// "now" timestamp instead of the actual watched date, which lived on the
// media row's createDate instead. Copy it over once.
async function main() {
	const reviews = await db.review.findMany({
		include: { media: true },
	});

	let updated = 0;
	for (const review of reviews) {
		if (!review.media.createDate) continue;

		await db.review.update({
			where: { id: review.id },
			data: { createDate: review.media.createDate },
		});
		updated++;
	}

	console.log(`Backfilled createDate for ${updated}/${reviews.length} reviews`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
