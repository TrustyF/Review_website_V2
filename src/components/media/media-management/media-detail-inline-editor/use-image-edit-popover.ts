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
	// or null if nothing's staged there yet.
	stagedSrc: string | null;
	// Hands the picked filePath (or pasted URL) and its preview src (null for
	// a pasted URL) straight to the page-level draft — see
	// media-publish-store.ts. Purely local: no DB write happens until
	// MediaPublishButton's Publish is clicked, so this never fails and never
	// needs to be awaited.
	onStage: (path: string, previewSrc: string | null) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [urlInput, setUrlInput] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);

	// Two layers, most-recent-wins: already staged in the page-level draft, or
	// the last-published value.
	const src = stagedSrc ?? initialSrc;

	function close() {
		setUrlInput("");
		setIsOpen(false);
	}

	// The only way the popover closes — an outside click or Escape — so an
	// admin can pick through several options in a row (comparing each against
	// the live preview) without it closing out from under them after every
	// one. Only wired up while actually open, so it costs nothing the rest of
	// the time.
	useOutsideClick(containerRef, close, {
		enabled: isOpen,
		escapeToo: true,
	});

	// Stages straight into the page-level draft — every pick is a committed
	// choice now, not a preview to compare before a separate Stage step (see
	// EditImagePopover's own removal of that button) — but the popover itself
	// stays open (see useOutsideClick above) so another pick can immediately
	// follow.
	function pick(image: PickableImage) {
		onStage(image.filePath, image.previewSrc);
	}

	// Stages the pasted URL the same way pick() stages a picker option — no
	// safe preview for an arbitrary un-allowlisted host until it's actually
	// resolved on publish (see onStage's own comment). Clears the input once
	// applied so the field's own emptiness marks it as staged, but leaves the
	// popover open, same as pick().
	function submitUrl() {
		const url = urlInput.trim();
		if (!url) return;
		onStage(url, null);
		setUrlInput("");
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
		close,
	};
}
