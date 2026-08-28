import { create } from "zustand";

// What PosterEditTrigger/BannerEditTrigger have staged but not yet written
// to the DB — see each field's own comment on MediaPublishButton for why
// nothing here hits the server until that button is clicked. previewSrc is
// the picker option's own proxied thumb/full src (safe for next/image with
// no download needed); it's null for a pasted URL, which has no safe
// preview until it's actually been through resolvePoster/resolveBanner on
// publish — same "no preview yet" gap that already existed pre-publish, not
// a new one.
export type PendingReview = {
	rating: number | null;
	liked: boolean;
	difficulty: number | null;
	body: string;
};

export type MediaEditDraft = {
	mediaId: number;
	posterPath: string | null;
	posterPreviewSrc: string | null;
	bannerPath: string | null;
	bannerPreviewSrc: string | null;
	bannerFocusY: number | null;
	// rating/liked/difficulty are carried along unchanged from the review
	// ReviewBodyEditTrigger was seeded with — only body is actually editable
	// there — so MediaPublishButton has a complete object to hand saveReview
	// without needing its own copy of the review.
	pendingReview: PendingReview | null;
};

function emptyDraft(mediaId: number): MediaEditDraft {
	return {
		mediaId,
		posterPath: null,
		posterPreviewSrc: null,
		bannerPath: null,
		bannerPreviewSrc: null,
		bannerFocusY: null,
		pendingReview: null,
	};
}

// Keyed by mediaId (all fields live in one draft, not one store per field) so
// switching to a different media's detail page can't leave a stale staged
// poster/banner behind — starting a draft for a new mediaId always replaces
// whatever was there, rather than merging onto a different item's edits.
export const useMediaPublishStore = create<{
	draft: MediaEditDraft | null;
	stagePoster: (
		mediaId: number,
		path: string,
		previewSrc: string | null,
	) => void;
	stageBanner: (
		mediaId: number,
		path: string,
		previewSrc: string | null,
	) => void;
	stageBannerFocus: (mediaId: number, focusY: number) => void;
	stageReview: (mediaId: number, review: PendingReview) => void;
	clear: () => void;
}>((set, get) => ({
	draft: null,
	stagePoster: (mediaId, path, previewSrc) => {
		const current = get().draft;
		const base = current?.mediaId === mediaId ? current : emptyDraft(mediaId);
		set({ draft: { ...base, posterPath: path, posterPreviewSrc: previewSrc } });
	},
	stageBanner: (mediaId, path, previewSrc) => {
		const current = get().draft;
		const base = current?.mediaId === mediaId ? current : emptyDraft(mediaId);
		set({ draft: { ...base, bannerPath: path, bannerPreviewSrc: previewSrc } });
	},
	stageBannerFocus: (mediaId, focusY) => {
		const current = get().draft;
		const base = current?.mediaId === mediaId ? current : emptyDraft(mediaId);
		set({ draft: { ...base, bannerFocusY: focusY } });
	},
	stageReview: (mediaId, review) => {
		const current = get().draft;
		const base = current?.mediaId === mediaId ? current : emptyDraft(mediaId);
		set({ draft: { ...base, pendingReview: review } });
	},
	clear: () => set({ draft: null }),
}));
