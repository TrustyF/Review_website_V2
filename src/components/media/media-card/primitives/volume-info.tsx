import styles from "./primitives.module.sass";

export function formatVolumeInfo(
	volumeCount: number | null,
	chapterCount: number | null,
) {
	if (!volumeCount && !chapterCount) return null;

	const parts = [];
	if (volumeCount)
		parts.push(`${volumeCount} volume${volumeCount === 1 ? "" : "s"}`);
	if (chapterCount) parts.push(`${chapterCount} chapters`);

	return parts.join(" · ");
}

export function MediaVolumeInfo({
	volumeCount,
	chapterCount,
}: {
	volumeCount: number | null;
	chapterCount: number | null;
}) {
	const formatted = formatVolumeInfo(volumeCount, chapterCount);
	if (!formatted) return null;
	return <div className={styles.info_line}>{formatted}</div>;
}
