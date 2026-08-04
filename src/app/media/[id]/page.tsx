import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { toMediaRecord, MediaRecord } from "@/components/media/media-card/types";
import { MediaPoster } from "@/components/media/media-card/primitives/poster";
import { MediaTitle } from "@/components/media/media-card/primitives/title";
import { MediaReleaseDate } from "@/components/media/media-card/primitives/release-date";
import { MediaReview } from "@/components/media/media-card/components/review/review";
import { MediaEditButton } from "@/components/media/media-card/primitives/edit-button";
import { ChangeLogList } from "@/components/media/change-log/change-log-list";
import { formatRuntime } from "@/components/media/media-card/primitives/runtime";
import styles from "./media-detail.module.sass";

const CurrencyFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	notation: "compact",
	maximumFractionDigits: 1,
});

function Fact({ label, value }: { label: string; value: string }) {
	return (
		<div className={styles.fact}>
			<dt className={styles.fact_label}>{label}</dt>
			<dd className={styles.fact_value}>{value}</dd>
		</div>
	);
}

// Renders the handful of fields that differ between media types — each type
// keeps its data on a different relation (media.movie, media.tvShow, ...),
// so this just picks the right one and lays out whichever fields are set.
function MediaTypeFacts({ media }: { media: MediaRecord }) {
	switch (media.type) {
		case "MOVIE":
		case "SHORT": {
			const { runtime, budget, revenue, tagline } = media.movie;
			return (
				<dl className={styles.facts}>
					{tagline && (
						<Fact
							label="Tagline"
							value={tagline}
						/>
					)}
					{runtime != null && (
						<Fact
							label="Runtime"
							value={formatRuntime(runtime) ?? `${runtime}m`}
						/>
					)}
					{budget != null && (
						<Fact
							label="Budget"
							value={CurrencyFormatter.format(budget)}
						/>
					)}
					{revenue != null && (
						<Fact
							label="Revenue"
							value={CurrencyFormatter.format(revenue)}
						/>
					)}
				</dl>
			);
		}
		case "TVSHOW": {
			const { seasonCount, episodeCount, network } = media.tvShow;
			return (
				<dl className={styles.facts}>
					{network && (
						<Fact
							label="Network"
							value={network}
						/>
					)}
					{seasonCount != null && (
						<Fact
							label="Seasons"
							value={String(seasonCount)}
						/>
					)}
					{episodeCount != null && (
						<Fact
							label="Episodes"
							value={String(episodeCount)}
						/>
					)}
				</dl>
			);
		}
		case "MANGA":
		case "COMIC": {
			const source = media.type === "MANGA" ? media.manga : media.comic;
			return (
				<dl className={styles.facts}>
					{source.volumeCount != null && (
						<Fact
							label="Volumes"
							value={String(source.volumeCount)}
						/>
					)}
					{source.chapterCount != null && (
						<Fact
							label="Chapters"
							value={String(source.chapterCount)}
						/>
					)}
				</dl>
			);
		}
		case "GAME": {
			const { platform } = media.game;
			return (
				<dl className={styles.facts}>
					{platform && (
						<Fact
							label="Platform"
							value={platform}
						/>
					)}
				</dl>
			);
		}
	}
}

export default async function MediaDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const mediaId = Number(id);
	if (!Number.isFinite(mediaId)) notFound();

	const raw = await db.media.findUnique({
		where: { id: mediaId },
		include: {
			movie: true,
			tvShow: true,
			manga: true,
			comic: true,
			game: true,
			review: true,
			originCountry: true,
			mediaGenres: { include: { genre: true } },
			credits: {
				include: { person: true, company: true, role: true },
				orderBy: { order: "asc" },
			},
			changeLog: { orderBy: { createdAt: "desc" } },
		},
	});
	if (!raw) notFound();

	const media = await toMediaRecord(raw);

	const genres = raw.mediaGenres.map((mediaGenre) => mediaGenre.genre.name);

	// Same person can be attached to a role more than once (e.g. duplicate
	// TMDB credit rows) — dedupe per role so names don't repeat.
	const creditsByRole = new Map<string, Set<string>>();
	for (const credit of raw.credits) {
		const name = credit.person?.name ?? credit.company?.name;
		if (!name) continue;
		const names = creditsByRole.get(credit.role.name);
		if (names) names.add(name);
		else creditsByRole.set(credit.role.name, new Set([name]));
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<div className={styles.poster}>
					<MediaPoster
						src={media.posterSrc}
						title={media.title}
					/>
				</div>
				<div className={styles.header_info}>
					<div className={styles.title_row}>
						<MediaTitle
							title={media.title}
							className={styles.title}
						/>
						<MediaEditButton
							media={media}
							className={styles.edit_button}
						/>
					</div>
					{media.alternateTitle && (
						<div className={styles.alt_title}>{media.alternateTitle}</div>
					)}

					<div className={styles.meta_row}>
						<MediaReleaseDate date={media.releaseDate} />
						{raw.originCountry && (
							<span>
								{raw.originCountry.flag} {raw.originCountry.name}
							</span>
						)}
					</div>

					{genres.length > 0 && (
						<div className={styles.genres}>
							{genres.map((genre) => (
								<span
									className={styles.genre}
									key={genre}
								>
									{genre}
								</span>
							))}
						</div>
					)}

					{media.overview && <p className={styles.overview}>{media.overview}</p>}

					<MediaTypeFacts media={media} />

					{creditsByRole.size > 0 && (
						<details className={styles.credits}>
							<summary className={styles.credits_summary}>
								Credits
								<span className={styles.credits_count}>
									{creditsByRole.size}
								</span>
							</summary>
							<div className={styles.credits_list}>
								{[...creditsByRole.entries()].map(([role, names]) => (
									<div
										className={styles.credit_row}
										key={role}
									>
										<span className={styles.credit_role}>{role}</span>
										<span className={styles.credit_names}>
											{[...names].join(", ")}
										</span>
									</div>
								))}
							</div>
						</details>
					)}
				</div>
			</div>

			<section className={styles.section}>
				<h2 className={styles.section_title}>Review</h2>
				<MediaReview review={media.review} />
			</section>

			<section className={styles.section}>
				<h2 className={styles.section_title}>Change log</h2>
				<ChangeLogList entries={raw.changeLog} />
			</section>
		</div>
	);
}
