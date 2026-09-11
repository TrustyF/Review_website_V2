import type { Locale } from "@/lib/i18n/get-locale";
import styles from "./primitives.module.sass";

export function MediaReleaseDate({ date }: { date: Date | null }) {
	if (!date) return null;
	return <div className={styles.release_date}>{date.getFullYear()}</div>;
}

export function formatReleaseDate(date: Date | null, locale: Locale): string | null {
	if (!date) return null;
	return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
		month: "short",
		day: "numeric",
	}).format(date);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30.44;
const DAYS_PER_YEAR = 365.25;

// RelativeTimeFormat always leads with a directional literal ("in "/"dans ") ahead of the
// integer+unit parts — dropped here since this is a bare countdown, not a "in the past/future" phrase.
function formatQuantity(rtf: Intl.RelativeTimeFormat, value: number, unit: Intl.RelativeTimeFormatUnit): string {
	return rtf
		.formatToParts(value, unit)
		.slice(1)
		.map((part) => part.value)
		.join("")
		.trim();
}

// Coarsest unit that's still >= 1 — years while over a year out, then months, then days.
// Past/same-day dates return null: a countdown only makes sense for what hasn't released yet.
export function formatTimeUntilRelease(date: Date | null, locale: Locale): string | null {
	if (!date) return null;
	const days = (date.getTime() - Date.now()) / DAY_MS;
	if (days < 1) return null;

	const rtf = new Intl.RelativeTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
		numeric: "always",
	});
	if (days >= DAYS_PER_YEAR) return formatQuantity(rtf, Math.round(days / DAYS_PER_YEAR), "year");
	if (days >= DAYS_PER_MONTH) return formatQuantity(rtf, Math.round(days / DAYS_PER_MONTH), "month");
	return formatQuantity(rtf, Math.round(days), "day");
}
