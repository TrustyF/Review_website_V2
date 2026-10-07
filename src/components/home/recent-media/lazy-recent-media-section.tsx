"use client";
import { useEffect, useRef, useState } from "react";
import { fetchRecentMediaSection } from "./recent-media-actions";
import type { RecentMediaSectionData } from "./recent-media-query";
import type { RecentMediaGroup } from "./recent-media-groups";
import { RecentMediaSections } from "./recent-media-sections";
import styles from "./lazy-recent-media-section.module.sass";

type Props = {
	group: RecentMediaGroup;
};

// Defers even the DB query for this group's sections until they scroll near the viewport,
// instead of fetching every media type's recent/watched lists up front on every home page visit.
export function LazyRecentMediaSection({ group }: Props) {
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
				fetchRecentMediaSection(group).then(setData);
			},
			{ rootMargin: "600px" },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [group]);

	if (data) {
		return (
			<RecentMediaSections
				group={group}
				recentReleases={data.recentReleases}
				recentlyWatched={data.recentlyWatched}
			/>
		);
	}

	return <div className={styles.placeholder} ref={sentinelRef} />;
}
