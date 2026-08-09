"use client";
import { useRef, useState } from "react";
import { PickableImage } from "@/components/media/media-management/media-editor/components/image-picker";
import { useOutsideClick } from "@/lib/use-outside-click";

// Shared open/pick/save state machine behind PosterEditTrigger and
// BannerEditTrigger — the only real difference between "click the poster"
// and "click the banner" is which fetchOptions/save action gets wired in
// (see each trigger's own file), so that's the one thing this takes as a
// parameter rather than owning itself.
export function useImageEditPopover({
	initialSrc,
	save,
}: {
	initialSrc: string;
	// Wraps whichever single-field server action applies (updateMediaPoster/
	// updateMediaBanner) — takes the picked filePath or pasted URL, returns
	// the resolved, proxied src to show immediately.
	save: (path: string) => Promise<string>;
}) {
	// The actually-saved src — only ever changes on a successful saveDraft().
	const [committedSrc, setCommittedSrc] = useState(initialSrc);
	// What picking an option or applying a URL will commit if saveDraft() is
	// called — null means nothing's staged. previewSrc is only set for a
	// picked option (its proxied, safe-for-next/image preview); a pasted URL
	// stages a path but no previewSrc, same as the full editor modal, since
	// an arbitrary un-allowlisted host can't go through next/image before
	// it's actually resolved/downloaded on save.
	const [pendingPath, setPendingPath] = useState<string | null>(null);
	const [pendingPreviewSrc, setPendingPreviewSrc] = useState<string | null>(
		null,
	);
	const [isOpen, setIsOpen] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [urlInput, setUrlInput] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);

	const src = pendingPreviewSrc ?? committedSrc;

	function discardDraft() {
		setPendingPath(null);
		setPendingPreviewSrc(null);
		setUrlInput("");
		setError(null);
		setIsOpen(false);
	}

	// Discards anything staged but unsaved on an outside click or Escape —
	// only wired up while actually open, so it costs nothing the rest of the
	// time.
	useOutsideClick(containerRef, discardDraft, {
		enabled: isOpen,
		escapeToo: true,
	});

	// Only swaps in the proxied preview — no download, no DB write, so
	// picking a few options in a row to compare costs nothing. The field
	// itself only changes once saveDraft() actually runs.
	function pick(image: PickableImage) {
		setPendingPath(image.filePath);
		setPendingPreviewSrc(image.previewSrc);
	}

	// Stages the URL the same way pick() stages a picker option, but leaves
	// the live preview alone (see pendingPreviewSrc above) — the URL input
	// itself is the preview until save resolves it.
	function submitUrl() {
		const url = urlInput.trim();
		if (!url) return;
		setPendingPath(url);
		setPendingPreviewSrc(null);
	}

	async function saveDraft() {
		if (!pendingPath) {
			setIsOpen(false);
			return;
		}
		setIsSaving(true);
		setError(null);
		try {
			const resolved = await save(pendingPath);
			setCommittedSrc(resolved);
			setPendingPath(null);
			setPendingPreviewSrc(null);
			setUrlInput("");
			setIsOpen(false);
		} catch {
			setError("Failed to save. Try again.");
		} finally {
			setIsSaving(false);
		}
	}

	return {
		src,
		containerRef,
		isOpen,
		setIsOpen,
		isSaving,
		error,
		urlInput,
		setUrlInput,
		pick,
		submitUrl,
		saveDraft,
		discardDraft,
		// Exposed as the raw value (not just a hasPendingChange boolean) so
		// EditImagePopover can also tell whether the *currently typed* URL is
		// the thing staged, to show "will apply on save" for it specifically.
		pendingPath,
	};
}
