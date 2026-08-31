import { useRef, useState } from "react";
import { PickableImage } from "@/components/media/media-management/media-editor/components/image-picker";
import { useOutsideClick } from "@/lib/use-outside-click";

// Shared open/pick/stage state machine behind PosterEditTrigger and BannerEditTrigger — the only
// real difference is which fetchOptions/onStage callback gets wired in, taken as a parameter.
export function useImageEditPopover({
	initialSrc,
	stagedSrc,
	onStage,
}: {
	initialSrc: string;
	// The page-level draft's own preview for this field, or null if nothing's staged yet.
	stagedSrc: string | null;
	// Hands the picked filePath/URL and preview straight to the page-level draft. Purely local:
	// no DB write until Publish is clicked, so this never fails and never needs awaiting.
	onStage: (path: string, previewSrc: string | null) => void;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [urlInput, setUrlInput] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);

	// Most-recent-wins: staged draft value, or the last-published one.
	const src = stagedSrc ?? initialSrc;

	function close() {
		setUrlInput("");
		setIsOpen(false);
	}

	// Only way the popover closes, so an admin can pick through several options without it
	// closing after each one. Only wired up while open.
	useOutsideClick(containerRef, close, {
		enabled: isOpen,
		escapeToo: true,
	});

	// Every pick is a committed choice, not a preview needing a separate Stage step —
	// but the popover stays open so another pick can immediately follow.
	function pick(image: PickableImage) {
		onStage(image.filePath, image.previewSrc);
	}

	// Stages the pasted URL like pick() — no safe preview for an un-allowlisted host until
	// resolved on publish. Clears the input once applied but leaves the popover open.
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
