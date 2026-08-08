import { db } from "@/server/db/client";

// One-time backfill: ratedDate/reviewedDate (see saveReview) only get set
// going forward, the first time rating/body go from unset to set — every
// review that already had a rating/body before this migration would
// otherwise show neither "Watched on" nor "Reviewed on" forever. createDate
// is the closest approximation available for these pre-existing rows (and
// itself already backfilled from media.createDate — see
// backfill-review-created-date.ts), not the true original watch/review
// date, which was never recorded separately from rating/body existing at
// all.
async function main() {
	const reviews = await db.review.findMany();

	let ratedUpdated = 0;
	let reviewedUpdated = 0;
	for (const review of reviews) {
		const data: { ratedDate?: Date; reviewedDate?: Date } = {};
		if (review.rating != null && !review.ratedDate) {
			data.ratedDate = review.createDate;
			ratedUpdated++;
		}
		if (review.body?.trim() && !review.reviewedDate) {
			data.reviewedDate = review.createDate;
			reviewedUpdated++;
		}
		if (Object.keys(data).length === 0) continue;

		await db.review.update({ where: { id: review.id }, data });
	}

	console.log(
		`Backfilled ratedDate for ${ratedUpdated} review(s), reviewedDate for ${reviewedUpdated}/${reviews.length} review(s).`,
	);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
