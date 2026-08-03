import { MediaChangeLog } from "@prisma/client";
import styles from "./change-log-list.module.sass";

const DateFormatter = new Intl.DateTimeFormat("en-GB", {
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

const FIELD_LABELS: Record<string, string> = {
	rating: "Rating",
	liked: "Liked",
	difficulty: "Difficulty",
	body: "Review",
	posterPath: "Poster",
};

// Long free-text values (review bodies) would blow out the log — show a
// preview instead of the full text.
function formatValue(field: string, value: string | null): string {
	if (value === null) return "—";
	if (field === "liked") return value === "true" ? "Yes" : "No";
	if (field === "body") {
		return value.length > 60 ? `${value.slice(0, 60)}…` : value;
	}
	return value;
}

export function ChangeLogList({ entries }: { entries: MediaChangeLog[] }) {
	if (entries.length === 0) {
		return <div className={styles.empty}>No changes recorded yet.</div>;
	}

	return (
		<ul className={styles.list}>
			{entries.map((entry) => (
				<li
					className={styles.entry}
					key={entry.id}
				>
					<span className={styles.field}>
						{FIELD_LABELS[entry.field] ?? entry.field}
					</span>
					<span className={styles.change}>
						<span className={styles.old_value}>
							{formatValue(entry.field, entry.oldValue)}
						</span>
						→
						<span className={styles.new_value}>
							{formatValue(entry.field, entry.newValue)}
						</span>
					</span>
					<span className={styles.date}>
						{DateFormatter.format(entry.createdAt)}
					</span>
				</li>
			))}
		</ul>
	);
}
