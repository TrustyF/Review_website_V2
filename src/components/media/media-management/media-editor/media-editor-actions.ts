"use server";
import { db } from "@/server/db/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { MediaType } from "@prisma/client";
import { recordInvocation } from "@/server/dev/invocation-tracker";
import { MediaRecord, toMediaRecord } from "@/components/media/types";
import { invalidateSearchIndex } from "@/server/lib/search-index-version";
import { revalidateMediaPaths } from "@/server/cache/revalidate-media";

// Returns a MediaChangeLog row per field that actually changed. A field going from no
// prior value to having one is skipped too — it reads as noise ("— → 8"), not a real change.
function diffFields(
	mediaId: number,
	before: Record<string, unknown>,
	after: Record<string, unknown>,
) {
	const changes: {
		mediaId: number;
		field: string;
		oldValue: string | null;
		newValue: string | null;
	}[] = [];
	for (const field of Object.keys(after)) {
		const oldValue = before[field] ?? null;
		const newValue = after[field] ?? null;
		if (oldValue === newValue) continue;
		if (oldValue === null) continue;
		changes.push({
			mediaId,
			field,
			oldValue: String(oldValue),
			newValue: newValue == null ? null : String(newValue),
		});
	}
	return changes;
}

// The editor saves straight from its draft, so it loads the full row here rather than trusting a grid's trimmed MediaCardRecord.
export async function getMediaForEditor(
	mediaId: number,
): Promise<MediaRecord | null> {
	await requireAdmin();
	const raw = await db.media.findUnique({
		where: { id: mediaId },
		include: {
			movie: true,
			tvShow: true,
			manga: true,
			comic: true,
			game: true,
			book: true,
			review: true,
		},
	});
	return raw ? toMediaRecord(raw) : null;
}

export async function saveReview(
	mediaId: number,
	review: {
		rating: number | null;
		liked: boolean;
		difficulty: number | null;
		body: string | null;
		// No editor UI for this yet — written directly (e.g. via Prisma Studio).
		// Optional so existing callers (the editor modal) are unaffected.
		bodyFr?: string | null;
		// "Watched on" itself — optional so the inline editor's PendingReview (no date
		// field) leaves it untouched. Not diffed to the change log; see reviewDate/body above.
		createDate?: Date;
	},
	{ revalidate = true }: { revalidate?: boolean } = {},
) {
	await requireAdmin();

	// "Watched on" reads off Review.createDate, which only holds up if createDate never
	// predates an actual rating. Enforced here so it can't be bypassed by any other caller.
	if (review.rating == null) {
		throw new Error("A rating is required to save a review.");
	}

	// Same 0/1/2 (or null) domain the editor's number input clamps to, enforced here too so a
	// caller bypassing the UI can't write a value MediaPoster's notch logic wasn't meant to see.
	if (
		review.difficulty != null &&
		(!Number.isInteger(review.difficulty) ||
			review.difficulty < 0 ||
			review.difficulty > 2)
	) {
		throw new Error("Difficulty must be 0, 1, or 2.");
	}

	const [existing, media] = await Promise.all([
		db.review.findUnique({ where: { mediaId } }),
		db.media.findUniqueOrThrow({
			where: { id: mediaId },
			select: { type: true },
		}),
	]);

	// Set once, the first time body goes from unset to set. Keyed off reviewDate's presence
	// rather than re-derived every time, so clearing and rewriting the body later doesn't move it.
	const hadBody = Boolean(existing?.body?.trim());
	const hasBody = Boolean(review.body?.trim());
	const reviewDate =
		!existing?.reviewDate && !hadBody && hasBody ? new Date() : undefined;

	await db.review.upsert({
		where: { mediaId },
		update: { ...review, ...(reviewDate ? { reviewDate } : {}) },
		// initialRating only goes in the create branch — it never moves again once set, unlike `rating`.
		create: {
			mediaId,
			...review,
			initialRating: review.rating,
			...(reviewDate ? { reviewDate } : {}),
		},
	});

	// Only diff once a review already exists — the first save just creates it. Body/reviewDate stay
	// out of this — see change-log-list.tsx's synthesized "Reviewed on" entry instead.
	if (existing) {
		const changes = diffFields(mediaId, existing, {
			rating: review.rating,
			liked: review.liked,
			difficulty: review.difficulty,
		});
		if (changes.length) {
			await db.mediaChangeLog.createMany({ data: changes });
		}
	}

	if (revalidate) {
		revalidateMediaPaths(mediaId, media.type);
		revalidatePath("/activity");
	}
}

// A rewatch has no field to diff — "watched it again", not "rating changed" — so it's logged
// directly on request. Repeatable, unlike "reviewed": every call adds another row.
export async function logRewatch(mediaId: number) {
	await requireAdmin();
	const [, media] = await Promise.all([
		db.mediaChangeLog.create({
			data: { mediaId, field: "rewatched", oldValue: null, newValue: "true" },
		}),
		db.media.findUniqueOrThrow({
			where: { id: mediaId },
			select: { type: true },
		}),
	]);
	revalidateMediaPaths(mediaId, media.type);
	revalidatePath("/activity");
}

// The one path that lets base Media fields be hand-edited, for media a provider has no
// (or wrong) data for.
export async function saveMediaDetails(
	mediaId: number,
	details: {
		title: string;
		overview: string | null;
		releaseDate: string | null;
		isAdult: boolean;
	},
	{ revalidate = true }: { revalidate?: boolean } = {},
) {
	await requireAdmin();

	const existing = await db.media.findUnique({
		where: { id: mediaId },
		select: {
			title: true,
			overview: true,
			releaseDate: true,
			isAdult: true,
			type: true,
		},
	});

	const releaseDate = details.releaseDate
		? new Date(details.releaseDate)
		: null;

	await db.media.update({
		where: { id: mediaId },
		data: {
			title: details.title,
			overview: details.overview,
			releaseDate,
			isAdult: details.isAdult,
		},
	});

	const changes = diffFields(
		mediaId,
		{
			title: existing?.title,
			overview: existing?.overview,
			releaseDate: existing?.releaseDate?.toISOString().slice(0, 10) ?? null,
			isAdult: existing?.isAdult,
		},
		{
			title: details.title,
			overview: details.overview,
			releaseDate: releaseDate?.toISOString().slice(0, 10) ?? null,
			isAdult: details.isAdult,
		},
	);
	if (changes.length) {
		await db.mediaChangeLog.createMany({ data: changes });
	}

	invalidateSearchIndex();
	if (revalidate) revalidateMediaPaths(mediaId, existing!.type);
}

// Only among these two — they share the Movie submodel, so switching
// between them needs no data migration.
const RECLASSIFIABLE_TYPES = new Set<MediaType>([
	MediaType.MOVIE,
	MediaType.SHORT,
]);

// Applies immediately (like setMediaDeleted) since it affects which catalog
// page the item lives on — both old and new paths need revalidating.
export async function updateMediaType(mediaId: number, type: MediaType) {
	await requireAdmin();
	if (!RECLASSIFIABLE_TYPES.has(type)) {
		throw new Error("Can only reclassify between Movie and Short.");
	}

	const existing = await db.media.findUniqueOrThrow({
		where: { id: mediaId },
		select: { type: true },
	});
	if (!RECLASSIFIABLE_TYPES.has(existing.type)) {
		throw new Error("Can only reclassify between Movie and Short.");
	}
	if (existing.type === type) return;

	// Not logged to the change log — a reclassification isn't a meaningful change to show.
	await db.media.update({ where: { id: mediaId }, data: { type } });

	invalidateSearchIndex();
	revalidateMediaPaths(mediaId, existing.type);
	revalidateMediaPaths(mediaId, type);
}

// Soft delete just flips Media.isDeleted — public queries filter it out, but the row and /media/[id]
// stay put so this toggle can restore it (needed since @@unique([externalId, type]) still holds).
export async function setMediaDeleted(mediaId: number, isDeleted: boolean) {
	await requireAdmin();

	const existing = await db.media.findUnique({
		where: { id: mediaId },
		select: { isDeleted: true, type: true },
	});
	if (existing?.isDeleted === isDeleted) return;

	await db.media.update({ where: { id: mediaId }, data: { isDeleted } });
	await db.mediaChangeLog.create({
		data: {
			mediaId,
			field: "isDeleted",
			oldValue: String(existing?.isDeleted ?? false),
			newValue: String(isDeleted),
		},
	});

	invalidateSearchIndex();
	revalidateMediaPaths(mediaId, existing!.type);
}

// Irreversible: the row and every cascading relation (onDelete: Cascade in schema.prisma) are
// gone, so no change log entry follows. Cached poster/banner files are swept up later as orphans.
export async function hardDeleteMedia(mediaId: number) {
	await requireAdmin();
	const deleted = await db.media.delete({ where: { id: mediaId } });
	invalidateSearchIndex();
	revalidateMediaPaths(mediaId, deleted.type);
}

// Fired by MediaPublishButton once poster/banner/focus tweaks are done (see PosterEditTrigger/
// BannerEditTrigger, saved with revalidate: false) — one revalidation for the whole session.
export async function publishMediaEdits(
	mediaId: number,
	// Set when the staged draft included a review body edit (media-publish-store.ts's
	// pendingReview) — mirrors saveReview's revalidatePath("/activity"), skipped there via revalidate: false.
	{ includeActivity = false }: { includeActivity?: boolean } = {},
): Promise<void> {
	await requireAdmin();
	recordInvocation("action:publishMediaEdits");
	const media = await db.media.findUniqueOrThrow({
		where: { id: mediaId },
		select: { type: true },
	});
	revalidateMediaPaths(mediaId, media.type);
	if (includeActivity) revalidatePath("/activity");
}

// Same one-revalidation-per-session idea as publishMediaEdits, for the editor modal's Save button:
// the parallel saveReview/saveMediaDetails/updateMediaPoster/updateMediaBanner calls all pass revalidate: false, so this is the one call that refreshes anything.
export async function finalizeMediaEditorSave(
	mediaId: number,
	type: MediaType,
	{ includeActivity = false }: { includeActivity?: boolean } = {},
): Promise<void> {
	await requireAdmin();
	revalidateMediaPaths(mediaId, type);
	if (includeActivity) revalidatePath("/activity");
}
