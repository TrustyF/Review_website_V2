"use client";

import { useReviewEditorStore } from "@/components/media/media-editor/review-editor-store";
import { useIsAdminStore } from "@/lib/is-admin-store";
import { MediaRecord } from "@/components/media/types";
import { Hitbox } from "@/components/ui/hitbox";
import Image from "next/image";

type Props = {
	media: MediaRecord;
	className?: string | undefined;
};

export function MediaEditButton({ media, className }: Props) {
	const open = useReviewEditorStore((s) => s.open);
	const editingMediaId = useReviewEditorStore((s) => s.media?.id ?? null);
	const isAdmin = useIsAdminStore((s) => s.isAdmin);

	if (!media.id) return null;
	if (!isAdmin) return null;
	// This card is the editor's own preview of the media it's already
	// editing — showing an edit button there would just reopen itself.
	if (editingMediaId === media.id) return null;

	return (
		<Hitbox
			className={className}
			onClick={() => open(media)}
			padding={15}
		>
			<Image
				src={"/ui/edit_pen_1.svg"}
				width={20}
				height={20}
				alt={"edit pen"}
			/>
		</Hitbox>
	);
}
