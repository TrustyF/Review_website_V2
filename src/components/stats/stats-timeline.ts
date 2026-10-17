import type { MediaType } from "@prisma/client";
import {
	BROAD_GENRES,
	type StatsData,
	type TimeBin,
} from "@/components/stats/stats-types";

const DAY_MS = 86400000;
// Min reviews behind a quarter's average, pooled with the quarters either side.
const MIN_SAMPLE_PER_QUARTER = 5;
const QUARTER_WINDOW = 1;
const TOP_GENRE_SERIES = 6;

export type TimelineRow = {
	createDate: Date;
	rating: number | null;
	media: {
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

// Contiguous keys from first to last; a key's average pools its neighbours and
// is null when the key itself has too few values.
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
	const keys = [...groups.keys()].filter(
		(k) => groups.get(k)!.length >= minSample,
	);
	if (keys.length === 0) return [];
	const bins: TimeBin[] = [];
	for (let key = Math.min(...keys); key <= Math.max(...keys); key++) {
		if ((groups.get(key)?.length ?? 0) < minSample) {
			bins.push({ key, value: null });
			continue;
		}
		const pooled: number[] = [];
		for (let k = key - window; k <= key + window; k++)
			pooled.push(...(groups.get(k) ?? []));
		bins.push({
			key,
			value: pooled.reduce((a, b) => a + b, 0) / pooled.length,
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
	for (const { createDate } of rows) {
		const day = Math.floor((createDate.getTime() - calendarStart) / DAY_MS);
		if (day >= 0 && day < calendarDays) counts[day]!++;
	}

	// Genre shift: each title splits one unit of weight across its genres, so
	// a year's shares always sum to 100%.
	const weightByYear = new Map<number, Map<string, number>>();
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
		const y = createDate.getUTCFullYear();
		const weights = weightByYear.get(y) ?? new Map<string, number>();
		for (const name of names) {
			weights.set(name, (weights.get(name) ?? 0) + 1 / names.length);
			totalByGenre.set(name, (totalByGenre.get(name) ?? 0) + 1 / names.length);
		}
		weightByYear.set(y, weights);
	}
	const topGenres = [...totalByGenre.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, TOP_GENRE_SERIES)
		.map(([name]) => name);
	// Only years with genre data: an empty year would drop the stack to 0%.
	const genreYears = [...weightByYear.keys()].sort((a, b) => a - b);
	const yearTotal = (y: number) =>
		[...(weightByYear.get(y)?.values() ?? [])].reduce((a, b) => a + b, 0);
	const shareOf = (y: number, weight: number) => {
		const total = yearTotal(y);
		return total > 0 ? weight / total : 0;
	};
	const genreSeries = [
		...topGenres.map((name) => ({
			name,
			shares: genreYears.map((y) =>
				shareOf(y, weightByYear.get(y)?.get(name) ?? 0),
			),
		})),
		{
			name: null,
			shares: genreYears.map((y) => {
				const top = topGenres.reduce(
					(sum, name) => sum + (weightByYear.get(y)?.get(name) ?? 0),
					0,
				);
				return shareOf(y, yearTotal(y) - top);
			}),
		},
	];

	// Age of what I watch: when I logged it vs. when it came out.
	const age = rows.flatMap(({ createDate, media }) =>
		media.releaseDate
			? [
					{
						watched: Math.round(fractionalYear(createDate) * 100) / 100,
						released: Math.round(fractionalYear(media.releaseDate) * 100) / 100,
					},
				]
			: [],
	);

	const quarterKey = (d: Date) =>
		d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3);
	const ratingByQuarter = smoothedBins(
		rows.flatMap(({ createDate, rating }) =>
			rating != null ? [{ key: quarterKey(createDate), value: rating }] : [],
		),
		MIN_SAMPLE_PER_QUARTER,
		QUARTER_WINDOW,
	);

	return {
		calendar: {
			start: new Date(calendarStart).toISOString().slice(0, 10),
			counts,
		},
		genreShift: { years: genreYears, series: genreSeries },
		age,
		ratingByQuarter,
	};
}
