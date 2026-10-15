import type { Prisma } from "@prisma/client";
import type { TmdbKeywordInput } from "@/server/tmdb/schema";

// Replaces this media's keywords with TMDB's current set, creating any keyword rows not seen before.
export async function syncTmdbKeywords(
	tx: Prisma.TransactionClient,
	mediaId: number,
	keywords: TmdbKeywordInput[],
) {
	await tx.mediaKeyword.deleteMany({ where: { mediaId } });
	if (keywords.length === 0) return;

	await tx.keyword.createMany({
		data: keywords.map((k) => ({ externalId: String(k.id), name: k.name })),
		skipDuplicates: true,
	});
	const rows = await tx.keyword.findMany({
		where: { externalId: { in: keywords.map((k) => String(k.id)) } },
		select: { id: true },
	});
	await tx.mediaKeyword.createMany({
		data: rows.map((r) => ({ mediaId, keywordId: r.id })),
		skipDuplicates: true,
	});
}
