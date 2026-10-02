"use client";
import { Eye } from "lucide-react";
import { MediaType } from "@prisma/client";
import { useWatched } from "@/components/watched/watched-context";
import { Clickable } from "@/components/ui/clickable";
import { Tip } from "@/components/tips/tip/tip";
import {
	alreadyWatchedLabel,
	markAsWatchedLabel,
} from "@/components/media/media-verb-labels";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./watched-button.module.sass";

type Props = {
	mediaId: number;
	type: MediaType;
	initialIsWatched: boolean;
	className?: string | undefined;
};

// Signed-out visitors never see this; only rendered when there's a session.
export function WatchedButton({
	mediaId,
	type,
	initialIsWatched,
	className,
}: Props) {
	const dict = useDictionary();
	// Shared context (not local state) so marking watched also clears the watchlist button.
	const watched = useWatched();
	const isWatched = watched.ready
		? watched.isWatched(mediaId)
		: initialIsWatched;

	const label = isWatched
		? alreadyWatchedLabel(type, dict)
		: markAsWatchedLabel(type, dict);

	return (
		<Tip id="watched" text={dict.tips.watched} after="watchlist">
			<Clickable
				className={
					className ? `${styles.trigger} ${className}` : styles.trigger
				}
				disabled={!watched.ready}
				aria-pressed={isWatched}
				title={label}
				aria-label={label}
				onClick={() => watched.toggle(mediaId)}>
				<Eye size={16} />
			</Clickable>
		</Tip>
	);
}
