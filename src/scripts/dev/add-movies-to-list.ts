import { db } from "@/server/db/client";
import { MediaType, Prisma } from "@prisma/client";

// Edit this by hand for whatever batch you're pulling in this time — a
// title search, a release-year range, a specific director's credits, ...
// the actual condition varies too much run-to-run to squeeze into a single
// CLI arg. ANDed with the fixed type/isDeleted baseline in main() below.
// Example: every movie released in 2025.
const QUERY: Prisma.MediaWhereInput = {
	releaseDate: {
		gte: new Date("2024-01-01"),
		lt: new Date("2025-01-01"),
	},
};

// Bulk-adds every movie matching QUERY above to a list in one shot — the
// site's own AddMediaToList only adds one at a time via manual
// search-and-click, this is for "add every 2025 release to my Best Of
// list" style batch curation instead of dozens of individual clicks.
// New items append below whatever's already ranked (see list-actions.ts's
// addMediaToList, same reasoning: never jump ahead of an existing ranking),
// ordered by release date among themselves.
async function main() {
	const [, , listIdArg] = process.argv;
	if (!listIdArg) {
		console.error("Usage: npm run add_movies_to_list -- <listId>");
		process.exit(1);
	}

	const listId = Number(listIdArg);
	if (!Number.isInteger(listId)) {
		console.error(`Invalid listId: "${listIdArg}"`);
		process.exit(1);
	}

	const list = await db.list.findUnique({
		where: { id: listId },
		select: { id: true, title: true },
	});
	if (!list) {
		console.error(`No list with id ${listId}`);
		process.exit(1);
	}

	const matches = await db.media.findMany({
		where: {
			type: MediaType.MOVIE,
			isDeleted: false,
			...QUERY,
		},
		select: { id: true, title: true },
		orderBy: { releaseDate: "asc" },
	});

	if (matches.length === 0) {
		console.log("No movies matched the query.");
		return;
	}

	const existing = await db.listItem.findMany({
		where: { listId, mediaId: { in: matches.map((m) => m.id) } },
		select: { mediaId: true },
	});
	const alreadyInList = new Set(existing.map((e) => e.mediaId));
	const toAdd = matches.filter((m) => !alreadyInList.has(m.id));

	if (toAdd.length === 0) {
		console.log(
			`All ${matches.length} matching movie(s) are already in "${list.title}".`,
		);
		return;
	}

	const { _max } = await db.listItem.aggregate({
		where: { listId },
		_max: { rank: true },
	});
	let nextRank = (_max.rank ?? -1) + 1;

	await db.listItem.createMany({
		data: toAdd.map((m) => ({ listId, mediaId: m.id, rank: nextRank++ })),
		skipDuplicates: true,
	});

	console.log(`Added ${toAdd.length} movie(s) to "${list.title}":`);
	for (const m of toAdd) console.log(`  ${m.title}`);
	if (alreadyInList.size > 0) {
		console.log(`Skipped ${alreadyInList.size} already in the list.`);
	}
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
