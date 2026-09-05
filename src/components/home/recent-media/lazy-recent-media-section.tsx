"use client";
import { useEffect, useRef, useState } from "react";
import { MediaType } from "@prisma/client";
import { fetchRecentMediaSection } from "./recent-media-actions";
import { RecentMediaSectionData } from "./recent-media-query";
import { RecentMediaSections } from "./recent-media-sections";
import styles from "./lazy-recent-media-section.module.sass";

type Props = {
	type: MediaType;
};

// Defers even the DB query for this media type's sections until they scroll near the viewport,
// instead of fetching every media type's recent/watched lists up front on every home page visit.
export function LazyRecentMediaSection({ type }: Props) {
	const [data, setData] = useState<RecentMediaSectionData | null>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel) return;

		// rootMargin starts the fetch well before the section reaches the viewport edge.
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				observer.disconnect();
				fetchRecentMediaSection(type).then(setData);
			},
			{ rootMargin: "600px" },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [type]);

	if (data) {
		return (
			<RecentMediaSections
				type={type}
				recentReleases={data.recentReleases}
				recentlyWatched={data.recentlyWatched}
			/>
		);
	}

	return <div className={styles.placeholder} ref={sentinelRef} />;
}
