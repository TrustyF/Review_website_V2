import { db } from "@/server/db/client";
import { rebuildPersistedSearchIndex } from "@/components/search/search-actions";

// Run as part of `npm run build` so the durable search-index blob is warm
// before the first deploy's first visitor searches — see
// rebuildPersistedSearchIndex's own comment for why that first search would
// otherwise eat the DB-query-plus-Fuse-build cost.
async function main() {
	const itemCount = await rebuildPersistedSearchIndex();
	console.log(`Rebuilt search index (${itemCount} entries).`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
