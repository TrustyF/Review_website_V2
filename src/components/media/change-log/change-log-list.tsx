import Image from "next/image";
import { MediaChangeLog } from "@prisma/client";
import { StarIcon } from "@/components/media/icons/star-icon";
import { buildProxiedImageUrl } from "@/server/resolvers/image-proxy";
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

function posterThumbSrc(posterPath: string) {
	return buildProxiedImageUrl(`https://image.tmdb.org/t/p/w92${posterPath}`);
}

// Long free-text values (review bodies) would blow out the log — show a
// preview instead of the full text.
function ChangeValue({ field, value }: { field: string; value: string | null }) {
	if (value === null) return <span className={styles.empty_value}>—</span>;

	if (field === "posterPath") {
		return (
			<Image
				className={styles.poster_value}
				src={posterThumbSrc(value)}
				alt="Poster"
				width={46}
				height={69}
			/>
		);
	}

	if (field === "rating") {
		return (
			<span className={styles.rating_value}>
				{value}
				<StarIcon className={styles.rating_star} />
			</span>
		);
	}

	if (field === "liked") return <>{value === "true" ? "Yes" : "No"}</>;

	if (field === "body") {
		return <>{value.length > 60 ? `${value.slice(0, 60)}…` : value}</>;
	}

	return <>{value}</>;
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
							<ChangeValue
								field={entry.field}
								value={entry.oldValue}
							/>
						</span>
						→
						<span className={styles.new_value}>
							<ChangeValue
								field={entry.field}
								value={entry.newValue}
							/>
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
