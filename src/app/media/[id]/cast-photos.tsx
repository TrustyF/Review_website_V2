"use client";
import { useState } from "react";
import { Link } from "@/components/ui/link";
import { PersonPhoto } from "@/components/media/primitives/person-photo";
import { Clickable } from "@/components/ui/clickable";
import { useDictionary } from "@/lib/i18n/i18n-context";
import type { CreditLink } from "./credits-section";
import styles from "./media-detail.module.sass";

// 9 tiles fit 950px width without clipping; collapsed view shows exactly this.
const VISIBLE_WITHOUT_SCROLL = 9;

// Cast as tiles with placeholders for missing photos; collapsed to one row by default
export function CastPhotos({ entries }: { entries: CreditLink[] }) {
	const dict = useDictionary();
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
						<PersonPhoto
							src={entry.photoSrc}
							alt={entry.name}
							photoClassName={styles.cast_photo_image}
							placeholderClassName={styles.cast_photo_image}
						/>
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
						{expanded ? dict.castPhotos.showLess : dict.castPhotos.showAll(entries.length)}
					</span>
					<span className={styles.cast_expand_line} />
				</Clickable>
			)}
		</div>
	);
}
