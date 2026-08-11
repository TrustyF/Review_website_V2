import { Fragment } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { MediaChangeLog, MediaType, Review } from "@prisma/client";
import { StarIcon } from "@/components/media/icons/star-icon";
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
	// Milestones, not values that changed — see MILESTONE_FIELDS below, which
	// skips the old/new/arrow entirely for these. The date column (present on
	// every row already) is what actually answers "on" — the label just reads
	// naturally alongside it. "watched"/"reviewed" are never actually written
	// to MediaChangeLog — see the synthetic entries built below, sourced from
	// Review.createDate/reviewDate — only "rewatched" is a real row, from
	// logRewatch.
	watched: "Watched on",
	reviewed: "Reviewed on",
	rewatched: "Rewatched on",
};

// Rows for these fields are date-only markers — oldValue/newValue are just a
// "true" placeholder, not a real before/after worth rendering.
const MILESTONE_FIELDS = new Set(["watched", "reviewed", "rewatched"]);

// Never collide with a real row — Prisma's autoincrement ids start at 1. Used
// to recognize the synthetic entries below so they can skip the delete
// button ChangeLogEntryRow would otherwise give every other row (see its own
// id prop) — there's nothing in the database to delete.
const SYNTHETIC_WATCHED_ID = -1;
const SYNTHETIC_REVIEWED_ID = -2;

// Ignores time of day — only whether the calendar day matches, in local
// time. A "Reviewed on" landing the same day as "Watched on" (the common
// case — rate and review in one sitting) is redundant with it, so it's left
// out rather than shown as a second entry for the same date.
function isSameCalendarDay(a: Date, b: Date): boolean {
	return a.toDateString() === b.toDateString();
}

// A gap at least this long between two consecutive entries (chronologically
// adjacent, not necessarily adjacent in wall-clock activity elsewhere) gets
// a divider — reads the log as a timeline of activity bursts instead of one
// undifferentiated list, e.g. a flurry of edits right after adding it, then
// nothing until a rewatch months later.
const TIMELINE_GAP_DAYS = 1;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date): number {
	return Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY;
}

// "412 days later" is technically correct but nobody reads a gap that way —
// steps up to the largest unit that still reads naturally. Average month/
// year lengths (not calendar months) since this only has a day count to
// work from, not the two actual dates' month/year fields.
function formatGap(days: number): string {
	const rounded = Math.round(days);
	if (rounded < 30) {
		return `${rounded} day${rounded === 1 ? "" : "s"} later`;
	}
	const months = Math.round(days / 30.44);
	if (months < 12) {
		return `${months} month${months === 1 ? "" : "s"} later`;
	}
	const years = Math.round(days / 365.25);
	return `${years} year${years === 1 ? "" : "s"} later`;
}

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
	externalId: string | null;
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
				<StarIcon />
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
	review,
}: {
	entries: MediaChangeLog[];
	type: MediaType;
	externalId: string | null;
	// "Watched on"/"Reviewed on" are never written to MediaChangeLog at all —
	// synthesized here from Review.createDate/reviewDate instead (see
	// toMediaRecord's watchedDate and saveReview's own comment on
	// reviewDate), so they're just merged into the list at display time
	// rather than being real rows saveReview has to keep in sync.
	review: Review | null | undefined;
}) {
	// Filters out any real "watched"/"reviewed" row before merging in the
	// synthetic ones below — belt-and-suspenders against ever double-showing
	// either, in case a stale row from before they moved off MediaChangeLog
	// (or any other future writer) slips through.
	const realEntries = entries.filter(
		(entry) => entry.field !== "watched" && entry.field !== "reviewed",
	);

	const synthetic: MediaChangeLog[] = [];
	// A rating-less review can't happen going forward (saveReview requires
	// one to save at all) — this only guards rows that predate that
	// requirement, same as toMediaRecord's own watchedDate.
	if (review?.rating != null) {
		synthetic.push({
			id: SYNTHETIC_WATCHED_ID,
			mediaId: review.mediaId,
			field: "watched",
			oldValue: null,
			newValue: "true",
			createdAt: review.createDate,
			deletedAt: null,
		});
	}
	// Skipped when it lands the same calendar day as "Watched on" — see
	// isSameCalendarDay's own comment.
	if (
		review?.reviewDate &&
		!isSameCalendarDay(review.reviewDate, review.createDate)
	) {
		synthetic.push({
			id: SYNTHETIC_REVIEWED_ID,
			mediaId: review.mediaId,
			field: "reviewed",
			oldValue: null,
			newValue: "true",
			createdAt: review.reviewDate,
			deletedAt: null,
		});
	}

	const allEntries: MediaChangeLog[] = [...realEntries, ...synthetic].sort(
		(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
	);

	if (allEntries.length === 0) {
		return <div className={styles.empty}>No changes recorded yet.</div>;
	}
	const visibleCount = allEntries.filter(
		(entry) => entry.deletedAt === null,
	).length;

	return (
		<ChangeLogEmptyGate
			totalCount={allEntries.length}
			visibleCount={visibleCount}>
			<ul className={styles.list}>
				{allEntries.map((entry, index) => {
					const alt = index % 2 === 1;
					// Index-based (allEntries is unaffected by dividers being
					// interleaved into the actual rendered output below), unlike
					// alternating via CSS :nth-child would be.
					const prevEntry = allEntries[index - 1];
					const gapDays = prevEntry
						? daysBetween(prevEntry.createdAt, entry.createdAt)
						: 0;
					const showGapDivider = gapDays >= TIMELINE_GAP_DAYS;

					const row = (
						<>
							<span className={styles.field}>
								{FIELD_LABELS[entry.field] ?? entry.field}
							</span>
							{/* Milestone fields skip the value diff — the empty span still
							keeps its flex: 1 spacer role so .date stays right-aligned same
							as every other row. */}
							<span className={styles.change}>
								{!MILESTONE_FIELDS.has(entry.field) && (
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
										<ArrowRight size={14} className={styles.arrow_icon} />
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
						</>
					);

					const divider = showGapDivider && (
						<li className={styles.timeline_gap} aria-hidden="true">
							<span className={styles.timeline_gap_line} />
							<span className={styles.timeline_gap_label}>
								{formatGap(gapDays)}
							</span>
						</li>
					);

					// Not a real row (both synthetic ids are negative, real Prisma
					// ids never are) — nothing in the database for
					// ChangeLogEntryRow's delete button to act on.
					if (entry.id < 0) {
						return (
							<Fragment key={entry.id}>
								{divider}
								<li
									className={`${styles.entry} ${alt ? styles.entry_alt : ""}`}>
									{row}
								</li>
							</Fragment>
						);
					}

					return (
						<Fragment key={entry.id}>
							{divider}
							<ChangeLogEntryRow
								id={entry.id}
								alt={alt}
								initialDeletedAt={entry.deletedAt}>
								{row}
							</ChangeLogEntryRow>
						</Fragment>
					);
				})}
			</ul>
		</ChangeLogEmptyGate>
	);
}
