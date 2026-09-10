import { Fragment } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { MediaChangeLog, MediaType, Review } from "@prisma/client";
import { StarIcon } from "@/components/media/icons/star-icon";
import {
	rewatchedOnLabel,
	watchedOnLabel,
} from "@/components/media/media-verb-labels";
import {
	resolveChangelogBannerThumb,
	resolveChangelogPosterThumb,
} from "@/server/resolvers/poster-resolver";
import { ChangeLogEntryRow } from "./change-log-entry-row";
import { ChangeLogEmptyGate } from "./change-log-empty-gate";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getLocale } from "@/lib/i18n/get-locale";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import styles from "./change-log-list.module.sass";

// Locale-keyed since a fixed "en-GB" formatter would render month names in
// English even when the rest of the page is in French.
const DATE_FORMAT_LOCALE: Record<string, string> = { en: "en-GB", fr: "fr-FR" };

// Rows for these fields are date-only markers — oldValue/newValue is just a "true" placeholder.
const MILESTONE_FIELDS = new Set(["watched", "reviewed", "rewatched"]);

// Negative so they never collide with real (autoincrement) ids, letting synthetic entries skip
// the delete button — nothing in the database to delete.
const SYNTHETIC_WATCHED_ID = -1;
const SYNTHETIC_REVIEWED_ID = -2;

// Calendar-day only (local time) — a same-day "Reviewed on" is redundant with "Watched on".
function isSameCalendarDay(a: Date, b: Date): boolean {
	return a.toDateString() === b.toDateString();
}

// A gap at least this long between two chronologically adjacent entries gets a divider,
// so the log reads as bursts of activity instead of one undifferentiated list.
const TIMELINE_GAP_DAYS = 1;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysBetween(a: Date, b: Date): number {
	return Math.abs(a.getTime() - b.getTime()) / MS_PER_DAY;
}

// Steps up to the largest unit that reads naturally, using average month/year lengths
// since only a day count is available, not the actual calendar dates.
function formatGap(days: number, dict: Dictionary): string {
	const rounded = Math.round(days);
	if (rounded < 30) return dict.changeLog.gapDaysLater(rounded);
	const months = Math.round(days / 30.44);
	if (months < 12) return dict.changeLog.gapMonthsLater(months);
	const years = Math.round(days / 365.25);
	return dict.changeLog.gapYearsLater(years);
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
	const dict = await getDictionary();

	if (field === "posterPath") {
		// Content-addressed by mediaId + historical posterPath, so it keeps working after the current poster changes.
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
				alt={dict.changeLog.posterAlt}
				width={46}
				height={69}
			/>
		);
	}

	if (field === "bannerPath") {
		// Same idea as posterPath above, but landscape; bannerUrlFor doesn't need externalId.
		const thumbSrc = await resolveChangelogBannerThumb(mediaId, type, value);
		return (
			<Image
				className={styles.banner_value}
				src={thumbSrc}
				alt={dict.changeLog.bannerAlt}
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

	if (field === "liked") {
		return <>{value === "true" ? dict.changeLog.yes : dict.changeLog.no}</>;
	}

	if (field === "body") {
		return <>{value.length > 60 ? `${value.slice(0, 60)}…` : value}</>;
	}

	return <>{value}</>;
}

export async function ChangeLogList({
	entries,
	type,
	externalId,
	review,
}: {
	entries: MediaChangeLog[];
	type: MediaType;
	externalId: string | null;
	// "Watched on"/"Reviewed on" are never written to MediaChangeLog — synthesized from
	// Review.createDate/reviewDate and merged in at display time instead.
	review: Review | null | undefined;
}) {
	const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
	const dateFormatter = new Intl.DateTimeFormat(DATE_FORMAT_LOCALE[locale], {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
	const fieldLabels: Record<string, string> = {
		rating: dict.changeLog.fields.rating,
		liked: dict.changeLog.fields.liked,
		difficulty: dict.changeLog.fields.difficulty,
		body: dict.changeLog.fields.body,
		posterPath: dict.changeLog.fields.posterPath,
		bannerPath: dict.changeLog.fields.bannerPath,
		// Milestones (see MILESTONE_FIELDS) skip old/new/arrow; "watched"/"rewatched" are omitted
		// here since their wording depends on media type (see media-verb-labels.ts).
		reviewed: dict.changeLog.fields.reviewedOn,
	};
	// Belt-and-suspenders: drops any real "watched"/"reviewed" row before merging synthetic ones,
	// in case a stale row from before they moved off MediaChangeLog slips through.
	const realEntries = entries.filter(
		(entry) => entry.field !== "watched" && entry.field !== "reviewed",
	);

	const synthetic: MediaChangeLog[] = [];
	// Guards rows that predate saveReview's rating requirement.
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
	// Skipped when it lands the same calendar day as "Watched on".
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
		return <div className={styles.empty}>{dict.changeLog.empty}</div>;
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
					// Index-based, since allEntries excludes the dividers interleaved into the rendered output.
					const prevEntry = allEntries[index - 1];
					const gapDays = prevEntry
						? daysBetween(prevEntry.createdAt, entry.createdAt)
						: 0;
					const showGapDivider = gapDays >= TIMELINE_GAP_DAYS;

					const row = (
						<>
							<span className={styles.field}>
								{entry.field === "watched"
									? watchedOnLabel(type, dict)
									: entry.field === "rewatched"
										? rewatchedOnLabel(type, dict)
										: (fieldLabels[entry.field] ?? entry.field)}
							</span>
							{/* Milestone fields skip the value diff, but the empty span keeps .date right-aligned. */}
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
								{dateFormatter.format(entry.createdAt)}
							</span>
						</>
					);

					const divider = showGapDivider && (
						<li className={styles.timeline_gap} aria-hidden="true">
							<span className={styles.timeline_gap_line} />
							<span className={styles.timeline_gap_label}>
								{formatGap(gapDays, dict)}
							</span>
						</li>
					);

					// Synthetic ids are negative, real Prisma ids never are — nothing to delete.
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
