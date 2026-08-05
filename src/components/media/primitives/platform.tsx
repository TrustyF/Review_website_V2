import styles from "./primitives.module.sass";

// Game.platform is a comma-joined list (a game can be on many) — mini cards
// only have room for one line, so show the first platform plus a count of
// the rest instead of the full list.
export function formatPlatformSummary(platform: string | null) {
	if (!platform) return null;

	const names = platform.split(", ");
	if (names.length === 1) return names[0];
	return `${names[0]} +${names.length - 1}`;
}

export function MediaPlatform({ platform }: { platform: string | null }) {
	if (!platform) return null;
	return <div className={styles.info_line}>{platform}</div>;
}
