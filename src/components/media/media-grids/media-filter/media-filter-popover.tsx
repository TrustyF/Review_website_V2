"use client";
import { useMemo, useRef, useState } from "react";
import { Filter } from "lucide-react";
import { MediaRecord } from "@/components/media/types";
import {
	availableFilterFields,
	collectGenres,
	EMPTY_MEDIA_FILTER,
	isFilterActive,
	MediaFilterState,
} from "@/components/media/media-grids/media-filter/media-filter";
import { DualRangeSlider } from "@/components/media/media-grids/media-filter/dual-range-slider";
import { formatRuntime } from "@/components/media/primitives/runtime";
import { useOutsideClick } from "@/lib/use-outside-click";
import { Hitbox } from "@/components/ui/hitbox";
import styles from "./media-filter-popover.module.sass";

type Props = {
	// The full, *un*filtered media this grid is showing — used to derive
	// which genres and which filter fields (see FILTERABLE_FIELDS_BY_TYPE)
	// are actually worth offering, so e.g. a Runtime slider doesn't show up
	// on a page of nothing but games.
	media: MediaRecord[];
	filter: MediaFilterState;
	onChange: (next: MediaFilterState) => void;
};

// Rating scale matches the review editor's own rating input (media-editor-
// modal.tsx) — 0-10, half-point steps.
const RATING_MIN = 0;
const RATING_MAX = 10;
const RATING_STEP = 0.5;

// 210 rounds up past the longest runtime actually in the collection (206m)
// with a little headroom, rather than some arbitrary/unreachable ceiling.
const RUNTIME_MIN = 0;
const RUNTIME_MAX = 210;
const RUNTIME_STEP = 5;

function formatRating(value: number): string {
	return value.toFixed(1);
}

// formatRuntime (primitives/runtime.tsx) returns null for a falsy runtime —
// 0 is a legitimate slider position (the bottom of the range), not "no
// runtime to show", so that case is filled in here rather than in the
// shared helper itself.
function formatRuntimeLabel(value: number): string {
	return formatRuntime(value) ?? "0m";
}

// Generic filter trigger + popover, meant to drop onto any media grid
// (MediaFilterGrid, RankedList, ...) — the caller owns the filter state
// and is responsible for actually applying matchesMediaFilter to whatever
// it's rendering; this component only edits that state.
export function MediaFilterPopover({ media, filter, onChange }: Props) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const availableGenres = useMemo(() => collectGenres(media), [media]);
	const availableFields = useMemo(() => availableFilterFields(media), [media]);

	useOutsideClick(containerRef, () => setIsOpen(false), { enabled: isOpen });

	const activeCount =
		filter.includedGenres.size +
		(filter.minRating != null ? 1 : 0) +
		(filter.maxRating != null ? 1 : 0) +
		(filter.minRuntime != null ? 1 : 0) +
		(filter.maxRuntime != null ? 1 : 0);

	function toggleGenre(genre: string) {
		const next = new Set(filter.includedGenres);
		if (next.has(genre)) next.delete(genre);
		else next.add(genre);
		onChange({ ...filter, includedGenres: next });
	}

	return (
		<div className={styles.wrapper} ref={containerRef}>
			<Hitbox onClick={() => setIsOpen((v) => !v)} padding={15}>
				<div className={styles.trigger}>
					<Filter size={16} />
					{activeCount > 0 && (
						<span className={styles.count_badge}>{activeCount}</span>
					)}
				</div>
			</Hitbox>
			{isOpen && (
				<div className={styles.popover}>
					{availableFields.has("rating") && (
						<div className={styles.section}>
							<div className={styles.section_title}>Rating</div>
							<DualRangeSlider
								min={RATING_MIN}
								max={RATING_MAX}
								step={RATING_STEP}
								formatValue={formatRating}
								value={[
									filter.minRating ?? RATING_MIN,
									filter.maxRating ?? RATING_MAX,
								]}
								onChange={([lo, hi]) =>
									onChange({
										...filter,
										minRating: lo <= RATING_MIN ? null : lo,
										maxRating: hi >= RATING_MAX ? null : hi,
									})
								}
							/>
						</div>
					)}

					{availableFields.has("runtime") && (
						<div className={styles.section}>
							<div className={styles.section_title}>Runtime</div>
							<DualRangeSlider
								min={RUNTIME_MIN}
								max={RUNTIME_MAX}
								step={RUNTIME_STEP}
								formatValue={formatRuntimeLabel}
								value={[
									filter.minRuntime ?? RUNTIME_MIN,
									filter.maxRuntime ?? RUNTIME_MAX,
								]}
								onChange={([lo, hi]) =>
									onChange({
										...filter,
										minRuntime: lo <= RUNTIME_MIN ? null : lo,
										maxRuntime: hi >= RUNTIME_MAX ? null : hi,
									})
								}
							/>
						</div>
					)}

					{availableFields.has("genre") && availableGenres.length > 0 && (
						<div className={styles.section}>
							<div className={styles.section_title}>Genres</div>
							<ul className={styles.genre_list}>
								{availableGenres.map((genre) => (
									<li key={genre}>
										<label className={styles.label}>
											<input
												type="checkbox"
												checked={filter.includedGenres.has(genre)}
												onChange={() => toggleGenre(genre)}
											/>
											{genre}
										</label>
									</li>
								))}
							</ul>
						</div>
					)}

					{isFilterActive(filter) && (
						<button
							type="button"
							className={styles.clear_button}
							onClick={() => onChange(EMPTY_MEDIA_FILTER)}>
							Clear filters
						</button>
					)}
				</div>
			)}
		</div>
	);
}
