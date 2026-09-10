"use client";
import { useState } from "react";
import { Eye } from "lucide-react";
import { MediaType } from "@prisma/client";
import { markAsWatched, unmarkAsWatched } from "@/components/watched/watched-actions";
import { Clickable } from "@/components/ui/clickable";
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
	const [isWatched, setIsWatched] = useState(initialIsWatched);
	const [isPending, setIsPending] = useState(false);

	async function toggle() {
		const wasWatched = isWatched;
		setIsPending(true);
		setIsWatched(!wasWatched);
		try {
			if (wasWatched) await unmarkAsWatched(mediaId);
			else await markAsWatched(mediaId);
		} catch {
			setIsWatched(wasWatched);
		} finally {
			setIsPending(false);
		}
	}

	const label = isWatched
		? alreadyWatchedLabel(type, dict)
		: markAsWatchedLabel(type, dict);

	return (
		<Clickable
			className={className ? `${styles.trigger} ${className}` : styles.trigger}
			disabled={isPending}
			aria-pressed={isWatched}
			title={label}
			aria-label={label}
			onClick={toggle}>
			<Eye size={15} />
		</Clickable>
	);
}
