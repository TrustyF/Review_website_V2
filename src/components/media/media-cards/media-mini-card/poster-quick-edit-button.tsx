"use client";
import { CSSProperties, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageIcon } from "lucide-react";
import { MediaRecord } from "@/components/media/types";
import { Hitbox } from "@/components/ui/hitbox";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import { useImageEditPopover } from "@/components/media/media-management/media-detail-inline-editor/use-image-edit-popover";
import { EditImagePopover } from "@/components/media/media-management/media-detail-inline-editor/edit-image-popover";
import { getAlternativePosters, updateMediaPoster } from "@/components/media/media-management/media-editor/media-editor-actions";

const POPOVER_WIDTH = 400;
// No real measurement of the popover's own height (it varies with how many alternates load) —
// just enough headroom that opening near the bottom of the viewport doesn't run the picker off
// the bottom edge.
const POPOVER_HEIGHT_BUDGET = 480;
const GAP = 8;

type Props = {
	media: MediaRecord;
	className?: string | undefined;
	// Lets the card show the pick immediately (see media-mini-card-shell.tsx's own comment) —
	// null reverts to media.posterSrc, e.g. after a failed save.
	onPosterChange: (previewSrc: string | null) => void;
	// Smaller than the default 15 when stacked tightly against another admin action (see
	// media-mini-card-shell.tsx's .admin_actions) — the default's hit area would otherwise
	// overlap the neighboring button's.
	hitboxPadding?: number;
};

// Same popover the detail page's PosterEditTrigger uses, just triggered from a card in a grid
// instead of the poster itself — there's no single sensible anchor across a whole grid of cards,
// so this computes a position: fixed spot next to whichever card's button was clicked, instead of
// the position: absolute anchoring PosterEditTrigger relies on. Saves immediately via
// updateMediaPoster, unlike PosterEditTrigger's stage-until-Publish flow — a card has no publish
// step of its own.
export function PosterQuickEditButton({
	media,
	className,
	onPosterChange,
	hitboxPadding = 15,
}: Props) {
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported (same rule as MediaEditButton).
	const isAdmin = sessionIsAdmin && !isMobileViewport;

	const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null);
	// The portaled popover's own root — see the outside-click comment below.
	const popoverRef = useRef<HTMLDivElement>(null);

	const {
		containerRef,
		isOpen,
		setIsOpen,
		urlInput,
		setUrlInput,
		pick,
		submitUrl,
		close,
	} = useImageEditPopover({
		initialSrc: media.posterSrc,
		stagedSrc: null,
		onStage: (path, previewSrc) => {
			// Optimistic — see media-mini-card-shell.tsx's comment on why this can't wait for the
			// server round-trip.
			onPosterChange(previewSrc);
			updateMediaPoster(media.id, path).catch(() => onPosterChange(null));
		},
		// The popover is portaled to <body> (see below), so it's no longer a DOM descendant of
		// containerRef — without this, useImageEditPopover's outside-click check would treat every
		// click inside the popover as "outside" and close it immediately.
		extraContainerRef: popoverRef,
	});

	if (!media.id) return null;
	if (!isAdmin) return null;

	function open() {
		const rect = containerRef.current?.getBoundingClientRect();
		if (rect) {
			const left = Math.min(
				rect.right + GAP,
				window.innerWidth - POPOVER_WIDTH - GAP,
			);
			const top = Math.min(
				rect.top,
				window.innerHeight - POPOVER_HEIGHT_BUDGET,
			);
			setPopoverStyle({
				position: "fixed",
				top: Math.max(GAP, top),
				left: Math.max(GAP, left),
			});
		}
		setIsOpen(true);
	}

	return (
		<div className={className} ref={containerRef}>
			<Hitbox onClick={open} padding={hitboxPadding}>
				<ImageIcon size={16} aria-label="Edit poster" />
			</Hitbox>

			{isOpen &&
				popoverStyle &&
				// Portaled straight to <body> — media-mini-card-shell.module.sass's .wrapper uses
				// content-visibility: auto for perf, which implies contain: paint. That makes the
				// card a containing block for position: fixed descendants and clips them to its
				// own tiny box, so a popover rendered in place here would exist but never actually
				// be visible on screen.
				createPortal(
					<div ref={popoverRef}>
						<EditImagePopover
							title="Change poster"
							draft={media}
							fetchOptions={getAlternativePosters}
							onPick={pick}
							altText="Alternative poster option"
							errorText="Couldn't load alternative posters. Try again later."
							optionAspectRatio={undefined}
							urlInput={urlInput}
							onUrlInputChange={setUrlInput}
							onSubmitUrl={submitUrl}
							onClose={close}
							style={popoverStyle}
						/>
					</div>,
					document.body,
				)}
		</div>
	);
}
