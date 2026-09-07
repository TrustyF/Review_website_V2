"use server";
import { revalidatePath } from "next/cache";
import { db, dbPublic } from "@/server/db/client";
import { EnrichmentStatus } from "@prisma/client";
// asset-paths.ts directly (not poster-resolver.ts), same rationale as featured-manager-actions.ts.
import { toPosterSrc } from "@/server/resolvers/asset-paths";
import { fuzzySearch } from "@/lib/fuzzy-search";
import { requireAdmin } from "@/lib/auth/require-admin";

export type DigestReviewSummary = {
	id: number;
	title: string;
	type: string;
	posterSrc: string;
};

// Same ordering digest-email-props.ts uses for this section, so this list reads in send order.
const IN_DIGEST_ORDER_BY = [
	{ review: { reviewDate: { sort: "desc" as const, nulls: "last" as const } } },
	{ review: { createDate: "desc" as const } },
];

export async function getDigestReviews(): Promise<DigestReviewSummary[]> {
	await requireAdmin();
	const media = await dbPublic.media.findMany({
		where: { review: { inDigest: true } },
		select: { id: true, title: true, type: true, posterPath: true },
		orderBy: IN_DIGEST_ORDER_BY,
	});
	return media.map((m) => ({
		id: m.id,
		title: m.title,
		type: m.type,
		posterSrc: toPosterSrc(m.id, m.posterPath),
	}));
}

// Reviewed (has a body), not-already-selected media — a body is what
// guarantees reviewDate is set, which the email template requires.
function candidateWhere() {
	return {
		enrichmentStatus: EnrichmentStatus.DONE,
		review: {
			inDigest: false,
			AND: [{ body: { not: null } }, { body: { not: "" } }],
		},
	};
}

const SEARCH_LIMIT = 20;
const SUGGESTION_LIMIT = 5;

const FUSE_OPTIONS = {
	keys: ["title"],
	threshold: 0.35,
	ignoreLocation: true,
};

export async function searchDigestCandidates(
	query: string,
): Promise<DigestReviewSummary[]> {
	await requireAdmin();
	const trimmed = query.trim();
	if (!trimmed) return [];

	const candidates = await dbPublic.media.findMany({
		where: candidateWhere(),
		select: { id: true, title: true, type: true, posterPath: true },
		orderBy: { id: "asc" },
	});

	return fuzzySearch(candidates, FUSE_OPTIONS, trimmed, SEARCH_LIMIT).map(
		(m) => ({
			id: m.id,
			title: m.title,
			type: m.type,
			posterSrc: toPosterSrc(m.id, m.posterPath),
		}),
	);
}

// Most-recently-reviewed eligible candidates, so an admin can pick from
// these without having to type a search query first.
export async function getSuggestedDigestReviews(): Promise<
	DigestReviewSummary[]
> {
	await requireAdmin();
	const media = await dbPublic.media.findMany({
		where: candidateWhere(),
		select: { id: true, title: true, type: true, posterPath: true },
		orderBy: IN_DIGEST_ORDER_BY,
		take: SUGGESTION_LIMIT,
	});
	return media.map((m) => ({
		id: m.id,
		title: m.title,
		type: m.type,
		posterSrc: toPosterSrc(m.id, m.posterPath),
	}));
}

// A plain update, never a create — a review must already exist with a body to be selectable at all.
export async function setReviewInDigest(
	mediaId: number,
	inDigest: boolean,
): Promise<void> {
	await requireAdmin();
	await db.review.update({ where: { mediaId }, data: { inDigest } });
	revalidatePath("/admin/digest");
}

export async function clearAllDigestReviews(): Promise<void> {
	await requireAdmin();
	await db.review.updateMany({
		where: { inDigest: true },
		data: { inDigest: false },
	});
	revalidatePath("/admin/digest");
}
