import { create } from "zustand";

// Staged but not yet written to the DB, until MediaPublishButton is clicked. previewSrc is null
// for a pasted URL, which has no safe preview until resolvePoster/resolveBanner runs on publish.
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
	// rating/liked/difficulty carried unchanged (only body is editable) so MediaPublishButton
	// has a complete object to hand saveReview.
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

// Keyed by mediaId so navigating to a different media's page can't leave a stale staged edit
// behind — a new mediaId always replaces the draft rather than merging onto it.
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
