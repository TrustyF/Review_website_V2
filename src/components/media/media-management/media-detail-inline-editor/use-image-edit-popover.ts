"use client";
import { useRef, useState } from "react";
import { PickableImage } from "@/components/media/media-management/media-editor/components/image-picker";
import { useOutsideClick } from "@/lib/use-outside-click";

// Shared open/pick/stage state machine behind PosterEditTrigger and
// BannerEditTrigger — the only real difference between "click the poster"
// and "click the banner" is which fetchOptions/onStage callback gets wired
// in (see each trigger's own file), so that's the one thing this takes as a
// parameter rather than owning itself.
export function useImageEditPopover({
	initialSrc,
	stagedSrc,
	onStage,
}: {
	initialSrc: string;
	// The page-level draft's own preview for this field (media-publish-store),
	// or null if nothing's staged there yet — layered under this popover's own
	// in-progress pick (see `src` below).
	stagedSrc: string | null;
	// Hands the picked filePath (or pasted URL) and its preview src (null for
	// a pasted URL) off to the page-level draft — see media-publish-store.ts.
	// Purely local: no DB write happens until MediaPublishButton's Publish is
	// clicked, so this never fails and never needs to be awaited.
	onStage: (path: string, previewSrc: string | null) => void;
}) {
	// What picking an option or applying a URL will stage if saveDraft() is
	// called — null means nothing's staged. previewSrc is only set for a
	// picked option (its proxied, safe-for-next/image preview); a pasted URL
	// stages a path but no previewSrc, same as the full editor modal, since
	// an arbitrary un-allowlisted host can't go through next/image before
	// it's actually resolved/downloaded on publish.
	const [pendingPath, setPendingPath] = useState<string | null>(null);
	const [pendingPreviewSrc, setPendingPreviewSrc] = useState<string | null>(
		null,
	);
	const [isOpen, setIsOpen] = useState(false);
	const [urlInput, setUrlInput] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);

	// Three layers, most-recent-wins: still being picked in the open popover,
	// already staged in the page-level draft, or the last-published value.
	const src = pendingPreviewSrc ?? stagedSrc ?? initialSrc;

	function discardDraft() {
		setPendingPath(null);
		setPendingPreviewSrc(null);
		setUrlInput("");
		setIsOpen(false);
	}

	// Discards anything picked but not yet staged on an outside click or
	// Escape — only wired up while actually open, so it costs nothing the
	// rest of the time.
	useOutsideClick(containerRef, discardDraft, {
		enabled: isOpen,
		escapeToo: true,
	});

	// Only swaps in the proxied preview — no download, no DB write, so
	// picking a few options in a row to compare costs nothing. The page-level
	// draft itself only changes once saveDraft() actually runs.
	function pick(image: PickableImage) {
		setPendingPath(image.filePath);
		setPendingPreviewSrc(image.previewSrc);
	}

	// Stages the URL the same way pick() stages a picker option, but leaves
	// the live preview alone (see pendingPreviewSrc above) — the URL input
	// itself is the preview until it's actually resolved on publish.
	function submitUrl() {
		const url = urlInput.trim();
		if (!url) return;
		setPendingPath(url);
		setPendingPreviewSrc(null);
	}

	// Hands off to the page-level draft and closes — synchronous, since
	// nothing here touches the network (see onStage's own comment).
	function saveDraft() {
		if (!pendingPath) {
			setIsOpen(false);
			return;
		}
		onStage(pendingPath, pendingPreviewSrc);
		setPendingPath(null);
		setPendingPreviewSrc(null);
		setUrlInput("");
		setIsOpen(false);
	}

	return {
		src,
		containerRef,
		isOpen,
		setIsOpen,
		urlInput,
		setUrlInput,
		pick,
		submitUrl,
		saveDraft,
		discardDraft,
		// Exposed as the raw value (not just a hasPendingChange boolean) so
		// EditImagePopover can also tell whether the *currently typed* URL is
		// the thing staged, to show "will apply on publish" for it specifically.
		pendingPath,
	};
}
