"use client";
import { Eye } from "lucide-react";
import { useSession } from "next-auth/react";
import { MediaType } from "@prisma/client";
import { useWatched } from "@/components/watched/watched-context";
import { Clickable } from "@/components/ui/clickable";
import {
	alreadyWatchedLabel,
	markAsWatchedLabel,
} from "@/components/media/media-verb-labels";
import styles from "./media-hover-badge.module.sass";

type Props = {
	mediaId: number;
	type: MediaType;
	className?: string | undefined;
};

// Quick toggle for media cards in a grid; signed-out visitors never see this.
// Reads/writes through WatchedProvider so every card for the same media stays in sync.
export function MarkAsWatchedHoverButton({ mediaId, type, className }: Props) {
	const { data: session } = useSession();
	const { isWatched, toggle } = useWatched();

	if (!session?.user?.id) return null;

	const watched = isWatched(mediaId);
	const label = watched ? alreadyWatchedLabel(type) : markAsWatchedLabel(type);

	return (
		<Clickable
			className={className ? `${styles.badge} ${className}` : styles.badge}
			aria-pressed={watched}
			title={label}
			aria-label={label}
			onClick={() => toggle(mediaId)}>
			<Eye size={13} />
		</Clickable>
	);
}
