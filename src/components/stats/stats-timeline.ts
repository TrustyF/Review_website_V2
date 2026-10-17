import type { MediaType } from "@prisma/client";
import {
	BROAD_GENRES,
	type StatsData,
	type TimeBin,
} from "@/components/stats/stats-types";

const DAY_MS = 86400000;
// Each quarter averages the quarters within QUARTER_WINDOW of it, nearer ones
// weighted more; null when that window holds fewer than MIN_SAMPLE reviews.
const MIN_SAMPLE_PER_WINDOW = 15;
const QUARTER_WINDOW = 2;
const TOP_GENRE_SERIES = 6;

export type TimelineRow = {
	createDate: Date;
	rating: number | null;
	media: {
		id: number;
		title: string;
		titleFr: string | null;
		type: MediaType;
		releaseDate: Date | null;
		mediaGenres: { genreId: number }[];
	};
};

const fractionalYear = (d: Date) => {
	const y = d.getUTCFullYear();
	const start = Date.UTC(y, 0, 1);
	return y + (d.getTime() - start) / (Date.UTC(y + 1, 0, 1) - start);
};

// Contiguous keys from first to last review; each key is a triangular-weighted
// average of its window, null when the window has fewer than minSample values.
function smoothedBins(
	entries: { key: number; value: number }[],
	minSample: number,
	window: number,
): TimeBin[] {
	const groups = new Map<number, number[]>();
	for (const { key, value } of entries) {
		const group = groups.get(key) ?? [];
		group.push(value);
		groups.set(key, group);
	}
	if (groups.size === 0) return [];
	const keys = [...groups.keys()];
	const bins: TimeBin[] = [];
	for (let key = Math.min(...keys); key <= Math.max(...keys); key++) {
		let count = 0;
		let weightedSum = 0;
		let totalWeight = 0;
		for (let k = key - window; k <= key + window; k++) {
			const group = groups.get(k) ?? [];
			const weight = window + 1 - Math.abs(k - key);
			count += group.length;
			for (const v of group) weightedSum += v * weight;
			totalWeight += group.length * weight;
		}
		bins.push({
			key,
			value: count >= minSample ? weightedSum / totalWeight : null,
		});
	}
	return bins;
}

// Everything on the stats page's "over time" sections. Rows are full history
// (type-scoped); only the calendar narrows to the selected year.
export function buildTimeline(
	rows: TimelineRow[],
	genreNameById: Map<number, string>,
	year: number | null,
): StatsData["timeline"] {
	// Calendar: the selected year, or the last 365 days for "All".
	const today = Math.floor(Date.now() / DAY_MS);
	const calendarStart =
		year != null ? Date.UTC(year, 0, 1) : (today - 364) * DAY_MS;
	const calendarDays =
		year != null ? (Date.UTC(year + 1, 0, 1) - calendarStart) / DAY_MS : 365;
	const counts = new Array<number>(calendarDays).fill(0);
	const titles = Array.from(
		{ length: calendarDays },
		(): { title: string; titleFr: string | null }[] => [],
	);
	for (const { createDate, media } of rows) {
		const day = Math.floor((createDate.getTime() - calendarStart) / DAY_MS);
		if (day < 0 || day >= calendarDays) continue;
		counts[day]!++;
		titles[day]!.push({ title: media.title, titleFr: media.titleFr });
	}

	const quarterKey = (d: Date) =>
		d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3);

	// Genre shift: each title splits one unit of weight across its genres; a
	// genre's share is its weight over the quarter's smoothing window.
	const weightByQuarter = new Map<number, Map<string, number>>();
	const titlesByQuarter = new Map<number, number>();
	const totalByGenre = new Map<string, number>();
	for (const { createDate, media } of rows) {
		const names = [
			...new Set(
				media.mediaGenres
					.map((g) => genreNameById.get(g.genreId))
					.filter((n): n is string => !!n && !BROAD_GENRES.has(n)),
			),
		];
		if (names.length === 0) continue;
		const q = quarterKey(createDate);
		const weights = weightByQuarter.get(q) ?? new Map<string, number>();
		for (const name of names) {
			weights.set(name, (weights.get(name) ?? 0) + 1 / names.length);
			totalByGenre.set(name, (totalByGenre.get(name) ?? 0) + 1 / names.length);
		}
		weightByQuarter.set(q, weights);
		titlesByQuarter.set(q, (titlesByQuarter.get(q) ?? 0) + 1);
	}
	const topGenres = [...totalByGenre.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, TOP_GENRE_SERIES)
		.map(([name]) => name);
	const genreQuarters = [...weightByQuarter.keys()];
	const genreKeys: number[] = [];
	if (genreQuarters.length > 0)
		for (
			let q = Math.min(...genreQuarters);
			q <= Math.max(...genreQuarters);
			q++
		)
			genreKeys.push(q);
	// Same triangular window as the rating line; null below MIN_SAMPLE titles.
	const windowShares = genreKeys.map((key) => {
		let titles = 0;
		let total = 0;
		const byName = new Map<string, number>();
		for (let q = key - QUARTER_WINDOW; q <= key + QUARTER_WINDOW; q++) {
			const weight = QUARTER_WINDOW + 1 - Math.abs(q - key);
			titles += titlesByQuarter.get(q) ?? 0;
			for (const [name, w] of weightByQuarter.get(q) ?? []) {
				byName.set(name, (byName.get(name) ?? 0) + w * weight);
				total += w * weight;
			}
		}
		return titles >= MIN_SAMPLE_PER_WINDOW && total > 0
			? { byName, total }
			: null;
	});
	// Only well-sampled quarters: a gap would drop the stack to 0%.
	const kept = genreKeys.flatMap((key, i) => {
		const w = windowShares[i];
		return w ? [{ key, ...w }] : [];
	});
	const genreSeries = [
		...topGenres.map((name) => ({
			name,
			shares: kept.map((w) => (w.byName.get(name) ?? 0) / w.total),
		})),
		{
			name: null,
			shares: kept.map(
				(w) =>
					1 -
					topGenres.reduce((sum, name) => sum + (w.byName.get(name) ?? 0), 0) /
						w.total,
			),
		},
	];

	// Age of what I watch: when I logged it vs. when it came out.
	const age = rows.flatMap(({ createDate, media }) =>
		media.releaseDate
			? [
					{
						watched: Math.round(fractionalYear(createDate) * 100) / 100,
						released: Math.round(fractionalYear(media.releaseDate) * 100) / 100,
						mediaId: media.id,
						title: media.title,
						titleFr: media.titleFr,
					},
				]
			: [],
	);

	const ratingByQuarter = smoothedBins(
		rows.flatMap(({ createDate, rating }) =>
			rating != null ? [{ key: quarterKey(createDate), value: rating }] : [],
		),
		MIN_SAMPLE_PER_WINDOW,
		QUARTER_WINDOW,
	);

	return {
		calendar: {
			start: new Date(calendarStart).toISOString().slice(0, 10),
			counts,
			titles,
		},
		genreShift: { keys: kept.map((w) => w.key), series: genreSeries },
		age,
		ratingByQuarter,
	};
}
