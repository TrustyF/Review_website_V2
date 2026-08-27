"use client";
import { useState } from "react";
import { Link } from "@/components/ui/link";
import { PersonPhoto } from "@/components/media/primitives/person-photo";
import { Clickable } from "@/components/ui/clickable";
import type { CreditLink } from "./credits-section";
import styles from "./media-detail.module.sass";

// Exactly how many tiles fit in one row across .wrapper's own fixed 950px
// width (6rem tile + 0.5rem gap each, see .cast_photo_link — 9*96 + 8*8 =
// 928px, 10 would be 1032px) — collapsed view shows exactly this many rather
// than clipping a partial tile off, so there's nothing left over to fade or
// cut mid-image.
const VISIBLE_WITHOUT_SCROLL = 9;

// Cast's own row, shown as a strip of small headshots (name underneath each)
// instead of comma-separated text — an actor with no photo (never backfilled
// yet, or TMDB just doesn't have one) gets PersonPhoto's own placeholder tile
// instead of falling back to text, so the row stays a consistent strip of
// same-shaped tiles either way. Collapsed to exactly one full row by default
// — the toggle below swaps in the rest, wrapped into a full grid.
export function CastPhotos({ entries }: { entries: CreditLink[] }) {
	const [expanded, setExpanded] = useState(false);
	const hasMore = entries.length > VISIBLE_WITHOUT_SCROLL;
	const visibleEntries = expanded
		? entries
		: entries.slice(0, VISIBLE_WITHOUT_SCROLL);

	return (
		<div className={styles.cast_wrapper}>
			<span
				className={`${styles.cast_photos} ${expanded ? styles.cast_photos_expanded : styles.cast_photos_clipped}`}>
				{visibleEntries.map((entry) => (
					<Link
						key={entry.key}
						href={entry.href}
						className={styles.cast_photo_link}>
						<PersonPhoto src={entry.photoSrc} alt={entry.name} />
						<span className={styles.cast_photo_name}>{entry.name}</span>
						{entry.character && (
							<span className={styles.cast_photo_character}>
								{entry.character}
							</span>
						)}
					</Link>
				))}
			</span>
			{hasMore && (
				<Clickable
					className={styles.cast_expand_toggle}
					onClick={() => setExpanded((v) => !v)}>
					<span className={styles.cast_expand_line} />
					<span className={styles.cast_expand_label}>
						{expanded ? "Show less" : `Show all ${entries.length}`}
					</span>
					<span className={styles.cast_expand_line} />
				</Clickable>
			)}
		</div>
	);
}
