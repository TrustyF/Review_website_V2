import Image from "next/image";
import { MediaChangeLog, MediaType } from "@prisma/client";
import { StarIcon } from "@/components/media/icons/star-icon";
import { ArrowRightIcon } from "@/components/media/icons/arrow-right-icon";
import {
	resolveChangelogBannerThumb,
	resolveChangelogPosterThumb,
} from "@/server/resolvers/poster-resolver";
import { ChangeLogEntryRow } from "./change-log-entry-row";
import { ChangeLogEmptyGate } from "./change-log-empty-gate";
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
	bannerPath: "Banner",
	// A milestone, not a value that changed — see saveReview and the "reviewed"
	// case in the row rendering below, which skips the old/new/arrow entirely
	// for it. The date column (present on every row already) is what actually
	// answers "on" — this label just reads naturally alongside it.
	reviewed: "Reviewed on",
};

// Long free-text values (review bodies) would blow out the log — show a
// preview instead of the full text.
async function ChangeValue({
	field,
	value,
	mediaId,
	type,
	externalId,
}: {
	field: string;
	value: string | null;
	mediaId: number;
	type: MediaType;
	externalId: string;
}) {
	if (value === null) return null;

	if (field === "posterPath") {
		// Cached to disk at the smallest size each source offers (see
		// resolveChangelogPosterThumb) — content-addressed by mediaId +
		// this exact historical posterPath, so it keeps working even after
		// the media's current poster (or the remote source) moves on.
		const thumbSrc = await resolveChangelogPosterThumb(
			mediaId,
			type,
			externalId,
			value,
		);
		return (
			<Image
				className={styles.poster_value}
				src={thumbSrc}
				alt="Poster"
				width={46}
				height={69}
			/>
		);
	}

	if (field === "bannerPath") {
		// Same idea as posterPath above, but landscape and via
		// resolveChangelogBannerThumb — bannerUrlFor doesn't need externalId
		// (unlike posterUrlFor), so this skips it.
		const thumbSrc = await resolveChangelogBannerThumb(mediaId, type, value);
		return (
			<Image
				className={styles.banner_value}
				src={thumbSrc}
				alt="Banner"
				width={80}
				height={34}
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

export function ChangeLogList({
	entries,
	type,
	externalId,
}: {
	entries: MediaChangeLog[];
	type: MediaType;
	externalId: string;
}) {
	if (entries.length === 0) {
		return <div className={styles.empty}>No changes recorded yet.</div>;
	}
	const visibleCount = entries.filter((entry) => entry.deletedAt === null).length;

	return (
		<ChangeLogEmptyGate
			totalCount={entries.length}
			visibleCount={visibleCount}
		>
			<ul className={styles.list}>
				{entries.map((entry) => (
					<ChangeLogEntryRow
						key={entry.id}
						id={entry.id}
						initialDeletedAt={entry.deletedAt}
					>
						<span className={styles.field}>
							{FIELD_LABELS[entry.field] ?? entry.field}
						</span>
						{/* "reviewed" is a milestone, not a before/after value — the
						empty span still keeps its flex: 1 spacer role so .date
						stays right-aligned same as every other row. */}
						<span className={styles.change}>
							{entry.field !== "reviewed" && (
								<>
									<span className={styles.old_value}>
										<ChangeValue
											field={entry.field}
											value={entry.oldValue}
											mediaId={entry.mediaId}
											type={type}
											externalId={externalId}
										/>
									</span>
									<ArrowRightIcon className={styles.arrow_icon} />
									<span className={styles.new_value}>
										<ChangeValue
											field={entry.field}
											value={entry.newValue}
											mediaId={entry.mediaId}
											type={type}
											externalId={externalId}
										/>
									</span>
								</>
							)}
						</span>
						<span className={styles.date}>
							{DateFormatter.format(entry.createdAt)}
						</span>
					</ChangeLogEntryRow>
				))}
			</ul>
		</ChangeLogEmptyGate>
	);
}
