"use client";
import { Eye } from "lucide-react";
import { MediaType } from "@prisma/client";
import { alreadyWatchedLabel } from "@/components/media/media-verb-labels";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./seen-badge.module.sass";

type Props = {
	type: MediaType;
	className?: string | undefined;
};

// Read-only marker (not a toggle) — e.g. an admin browsing a recommendation list
// built for someone else. The viewer's own state still shows via MarkAsWatchedHoverButton.
export function SeenBadge({ type, className }: Props) {
	const dict = useDictionary();
	const label = alreadyWatchedLabel(type, dict);
	return (
		<span
			className={className ? `${styles.badge} ${className}` : styles.badge}
			title={label}
			aria-label={label}>
			<Eye size={12} />
		</span>
	);
}
