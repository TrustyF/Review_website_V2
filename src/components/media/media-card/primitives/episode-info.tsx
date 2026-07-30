import styles from "./primitives.module.sass";

export function formatEpisodeInfo(
	seasonCount: number | null,
	episodeCount: number | null,
) {
	if (!seasonCount && !episodeCount) return null;

	const parts = [];
	if (seasonCount)
		parts.push(`${seasonCount} season${seasonCount === 1 ? "" : "s"}`);
	if (episodeCount) parts.push(`${episodeCount} episodes`);

	return parts.join(" · ");
}

export function MediaEpisodeInfo({
	seasonCount,
	episodeCount,
}: {
	seasonCount: number | null;
	episodeCount: number | null;
}) {
	const formatted = formatEpisodeInfo(seasonCount, episodeCount);
	if (!formatted) return null;
	return <div className={styles.runtime}>{formatted}</div>;
}
