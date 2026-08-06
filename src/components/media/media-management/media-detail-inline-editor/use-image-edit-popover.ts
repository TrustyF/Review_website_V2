"use client";
import { useEffect, useRef, useState } from "react";
import { PickableImage } from "@/components/media/media-management/media-editor/components/image-picker";

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
	const [src, setSrc] = useState(initialSrc);
	const [isOpen, setIsOpen] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [urlInput, setUrlInput] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);

	// Closes on an outside click or Escape — only wired up while actually
	// open, so it costs nothing the rest of the time.
	useEffect(() => {
		if (!isOpen) return;

		function handlePointerDown(e: MouseEvent) {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		}
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") setIsOpen(false);
		}

		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen]);

	async function commit(path: string) {
		setIsSaving(true);
		setError(null);
		try {
			const resolved = await save(path);
			setSrc(resolved);
			setIsOpen(false);
			setUrlInput("");
		} catch {
			setError("Failed to save. Try again.");
		} finally {
			setIsSaving(false);
		}
	}

	function pick(image: PickableImage) {
		commit(image.filePath);
	}

	function submitUrl() {
		const url = urlInput.trim();
		if (!url) return;
		commit(url);
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
	};
}
