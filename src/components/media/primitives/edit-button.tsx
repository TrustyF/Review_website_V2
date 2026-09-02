"use client";

import { useReviewEditorStore } from "@/components/media/media-management/media-editor/review-editor-store";
import { useIsAdmin } from "@/lib/use-is-admin";
import { useIsMobileViewport } from "@/lib/use-is-mobile-viewport";
import { MediaRecord } from "@/components/media/types";
import { Hitbox } from "@/components/ui/hitbox";
import Image from "next/image";

type Props = {
	media: MediaRecord;
	className?: string | undefined;
	// Smaller than the default 15 when stacked tightly against another admin action (see
	// media-mini-card-shell.tsx's .admin_actions) — the default's hit area would otherwise
	// overlap the neighboring button's.
	hitboxPadding?: number;
};

export function MediaEditButton({ media, className, hitboxPadding = 15 }: Props) {
	const open = useReviewEditorStore((s) => s.open);
	const editingMediaId = useReviewEditorStore((s) => s.media?.id ?? null);
	const sessionIsAdmin = useIsAdmin();
	const isMobileViewport = useIsMobileViewport();
	// Mobile admin edits are intentionally unsupported (same rule as nav-admin-links.tsx).
	const isAdmin = sessionIsAdmin && !isMobileViewport;

	if (!media.id) return null;
	if (!isAdmin) return null;
	// This card is the editor's own preview of the media it's already editing — an edit button here would just reopen itself.
	if (editingMediaId === media.id) return null;

	return (
		<Hitbox className={className} onClick={() => open(media)} padding={hitboxPadding}>
			<Image
				src={"/ui/edit_pen_1.svg"}
				width={20}
				height={20}
				alt={"edit pen"}
			/>
		</Hitbox>
	);
}
