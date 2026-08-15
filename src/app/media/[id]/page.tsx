import { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { toMediaRecord, MediaRecord } from "@/components/media/types";
import { posterRatioFor } from "@/components/media/poster-ratio";
import { StarIcon } from "@/components/media/icons/star-icon";
import { MediaTitle } from "@/components/media/primitives/title";
import { MediaReleaseDate } from "@/components/media/primitives/release-date";
import { MediaEditButton } from "@/components/media/primitives/edit-button";
import { ChangeLogList } from "@/components/media/media-management/change-log/change-log-list";
import { formatRuntime } from "@/components/media/primitives/runtime";
import { PosterEditTrigger } from "@/components/media/media-management/media-detail-inline-editor/poster-edit-trigger";
import { BannerEditTrigger } from "@/components/media/media-management/media-detail-inline-editor/banner-edit-trigger";
import { ReviewBodyEditTrigger } from "@/components/media/media-management/media-detail-inline-editor/review-body-edit-trigger";
import { AddToListButton } from "@/components/lists/add-to-list-button/add-to-list-button";
import { AddToWatchlistButton } from "@/components/watchlist/add-to-watchlist-button/add-to-watchlist-button";
import { auth } from "@/auth";
import { MediaType } from "@prisma/client";
import {
	BANNER_GRAIN_OPACITY,
	toPersonPhotoSrc,
} from "@/server/resolvers/poster-resolver";
import { PersonPhoto } from "@/components/media/primitives/person-photo";
import styles from "./media-detail.module.sass";
import { CircularGauge } from "@/components/ui/circular-gauge";
import { Tooltip } from "@/components/ui/tooltip";
import { generateMediaMetadata } from "./metadata";

// See metadata.ts — kept there rather than inlined here so this file stays
// about rendering the page, not also building link-preview tags.
export const generateMetadata = generateMediaMetadata;

const PROVIDER_LABELS: Record<MediaType, string> = {
	[MediaType.MOVIE]: "TMDB",
	[MediaType.SHORT]: "TMDB",
	[MediaType.TVSHOW]: "TMDB",
	[MediaType.MANGA]: "MangaDex",
	[MediaType.COMIC]: "ComicVine",
	[MediaType.GAME]: "IGDB",
	[MediaType.BOOK]: "Google Books",
};

const CurrencyFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	notation: "compact",
	maximumFractionDigits: 1,
});

// Director/Actor/Studio are promoted out of the collapsed credits list (see
// below) — everything left in there is a long tail that varies a lot by
// source (TMDB crew jobs are free text, MangaDex/ComicVine/IGDB each have
// their own handful of role names). Known roles worth surfacing first get a
// rank here; anything unlisted falls back to alphabetical after them.
const ROLE_PRIORITY: Record<string, number> = {
	Writer: 0,
	Screenplay: 0,
	Creator: 0,
	Author: 0,
	Developer: 0,
	Story: 1,
	Artist: 1,
	Publisher: 1,
	"Executive Producer": 2,
	Producer: 3,
};

const TOP_ACTOR_COUNT = 10;

function Fact({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div className={styles.fact}>
			<dt className={styles.fact_label}>{label}</dt>
			<dd className={styles.fact_value}>{value}</dd>
		</div>
	);
}

type CreditLink = {
	key: string;
	href: string;
	name: string;
	order: number | null;
	// Only ever set on Actor entries (see the credit-building loop below) —
	// Person.photoPath itself is cast-only, and this is gated by role on top
	// of that so a person who's also credited as e.g. Director elsewhere
	// still never shows a photo there.
	photoSrc: string | null;
	// Only ever set on Actor entries, same gating as photoSrc.
	character: string | null;
};

// Comma-separated linked names — shared by the promoted Director/Cast/Studio
// facts and each row of the collapsed "everything else" list.
function CreditNames({ entries }: { entries: CreditLink[] }) {
	return (
		<span className={styles.credit_names}>
			{entries.map((entry, i) => (
				<span key={entry.key}>
					{i > 0 && ", "}
					<Link href={entry.href} className={styles.credit_link}>
						{entry.name}
					</Link>
				</span>
			))}
		</span>
	);
}

// Cast's own row, shown as a strip of small headshots (name underneath
// each) instead of comma-separated text — an actor with no photo (never
// backfilled yet, or TMDB just doesn't have one) gets a plain circular
// placeholder instead of falling back to text, so the row stays a
// consistent strip of circles either way.
function CastPhotos({ entries }: { entries: CreditLink[] }) {
	return (
		<span className={styles.cast_photos}>
			{entries.map((entry) => (
				<Link key={entry.key} href={entry.href} className={styles.cast_photo_link}>
					<PersonPhoto
						src={entry.photoSrc}
						alt={entry.name}
						photoClassName={styles.cast_photo}
						placeholderClassName={styles.cast_photo_placeholder}
					/>
					<span className={styles.cast_photo_name}>{entry.name}</span>
					{entry.character && (
						<span className={styles.cast_photo_character}>{entry.character}</span>
					)}
				</Link>
			))}
		</span>
	);
}

// Renders the handful of fields that differ between media types — each type
// keeps its data on a different relation (media.movie, media.tvShow, ...),
// so this just picks the right one and lays out whichever fields are set.
function MediaTypeFacts({ media }: { media: MediaRecord }) {
	switch (media.type) {
		// Budget/revenue/ROI render in the financials box beside the review
		// instead — nothing left here for movies/shorts.
		case "MOVIE":
		case "SHORT":
			return null;
		case "TVSHOW": {
			const { seasonCount, episodeCount, network } = media.tvShow;
			return (
				<dl className={styles.facts}>
					{network && <Fact label="Network" value={network} />}
					{seasonCount != null && (
						<Fact label="Seasons" value={String(seasonCount)} />
					)}
					{episodeCount != null && (
						<Fact label="Episodes" value={String(episodeCount)} />
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
						<Fact label="Volumes" value={String(source.volumeCount)} />
					)}
					{source.chapterCount != null && (
						<Fact label="Chapters" value={String(source.chapterCount)} />
					)}
				</dl>
			);
		}
		case "GAME": {
			const { platform } = media.game;
			return (
				<dl className={styles.facts}>
					{platform && <Fact label="Platform" value={platform} />}
				</dl>
			);
		}
		case "BOOK": {
			const { pageCount, isbn } = media.book;
			return (
				<dl className={styles.facts}>
					{pageCount != null && (
						<Fact label="Pages" value={String(pageCount)} />
					)}
					{isbn && <Fact label="ISBN" value={isbn} />}
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

	// allLists/watchlistItem only depend on mediaId (already known from the
	// route param), not on raw — none of these queries depend on each other,
	// so there's no reason to make this page wait on them one after another.
	const session = await auth();
	const [raw, allLists, watchlistItem] = await Promise.all([
		db.media.findUnique({
			where: { id: mediaId },
			include: {
				movie: true,
				tvShow: true,
				manga: true,
				comic: true,
				game: true,
				book: true,
				review: true,
				originCountry: true,
				credits: {
					include: { person: true, company: true, role: true },
					orderBy: { order: "asc" },
				},
				changeLog: { orderBy: { createdAt: "desc" } },
			},
		}),
		// For AddToListButton — every list, plus which ones (if any) already
		// have this media, so the popover can render pre-checked checkboxes
		// without a second round trip once it opens.
		db.list.findMany({
			select: {
				id: true,
				title: true,
				items: { where: { mediaId }, select: { mediaId: true } },
			},
			orderBy: { createDate: "desc" },
		}),
		// For AddToWatchlistButton — only signed-in visitors have a watchlist
		// to belong to.
		session?.user
			? db.watchlistItem.findUnique({
					where: { userId_mediaId: { userId: session.user.id, mediaId } },
				})
			: null,
	]);
	if (!raw) notFound();

	const media = toMediaRecord(raw);

	// Only movies/shorts carry a tagline (see MediaTypeFacts) — pulled out
	// here too since it now sits in the header's meta row, next to the
	// release date, rather than down in the type-specific facts list.
	const tagline =
		media.type === "MOVIE" || media.type === "SHORT"
			? media.movie.tagline
			: null;
	// Same story for runtime — it now sits in the info container under the
	// poster instead of the type-specific facts list.
	const runtime =
		media.type === "MOVIE" || media.type === "SHORT"
			? media.movie.runtime
			: null;
	const runtimeLabel = runtime != null ? (formatRuntime(runtime) ?? `${runtime}m`) : null;
	// Same story for budget/revenue/ROI — they now sit in the financials box
	// beside the review instead of the type-specific facts list.
	const budget =
		media.type === "MOVIE" || media.type === "SHORT" ? media.movie.budget : null;
	const revenue =
		media.type === "MOVIE" || media.type === "SHORT" ? media.movie.revenue : null;
	const roi =
		budget != null && revenue != null && budget !== 0
			? (revenue - budget) / budget
			: null;
	// Not type-specific (unlike tagline/runtime/budget/revenue above) — every
	// media type can carry a source's public rating.
	const publicRating = raw.publicRating;
	// null/0 both mean "not rated for difficulty" — same convention
	// MediaPoster's own corner notch uses (see poster.tsx).
	const difficulty = raw.review?.difficulty;

	const memberListIds = allLists
		.filter((list) => list.items.length > 0)
		.map((list) => list.id);

	// Same person/company can be attached to a role more than once (e.g.
	// duplicate TMDB credit rows) — dedupe per role by id, not just name, so
	// two different people who happen to share a name don't collapse. Only
	// the first occurrence is kept: raw.credits is already ordered by
	// billing order ascending, so for Actor that's the earliest (most
	// prominent) row for that person.
	const creditsByRole = new Map<string, Map<string, CreditLink>>();
	for (const credit of raw.credits) {
		// Scopes the destination page to this role (e.g. clicking a name under
		// "Director" lands on just their directing credits, not everything
		// they've ever been credited for).
		const roleQuery = `?role=${encodeURIComponent(credit.role.name)}`;
		const entry = credit.person
			? {
					key: `person-${credit.person.id}`,
					href: `/credits/person/${credit.person.id}${roleQuery}`,
					name: credit.person.name,
					order: credit.order,
					photoSrc:
						credit.role.name === "Actor"
							? toPersonPhotoSrc(credit.person.id, credit.person.photoPath)
							: null,
					character: credit.role.name === "Actor" ? credit.character : null,
				}
			: credit.company
				? {
						key: `company-${credit.company.id}`,
						href: `/credits/company/${credit.company.id}${roleQuery}`,
						name: credit.company.name,
						order: credit.order,
						photoSrc: null,
						character: null,
					}
				: null;
		if (!entry) continue;
		const byRole = creditsByRole.get(credit.role.name);
		if (byRole) {
			if (!byRole.has(entry.key)) byRole.set(entry.key, entry);
		} else {
			creditsByRole.set(credit.role.name, new Map([[entry.key, entry]]));
		}
	}

	// Director/Cast/Studio surface directly on the page — everything else
	// (writers, producers, publishers, ...) stays in the collapsed list,
	// ranked by ROLE_PRIORITY rather than left in arbitrary credit order.
	const directorEntries = [...(creditsByRole.get("Director")?.values() ?? [])];
	const studioEntries = [...(creditsByRole.get("Studio")?.values() ?? [])];
	const actorEntries = [...(creditsByRole.get("Actor")?.values() ?? [])]
		.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
		.slice(0, TOP_ACTOR_COUNT);

	const otherRoles = [...creditsByRole.entries()]
		.filter(
			([role]) => role !== "Director" && role !== "Studio" && role !== "Actor",
		)
		.sort(([a], [b]) => {
			const priorityDiff = (ROLE_PRIORITY[a] ?? 99) - (ROLE_PRIORITY[b] ?? 99);
			return priorityDiff !== 0 ? priorityDiff : a.localeCompare(b);
		});

	return (
		<div className={styles.wrapper}>
			{raw.isDeleted && (
				<div className={styles.deleted_banner}>
					This item is soft-deleted — hidden from every list. Open the editor to
					restore it or delete it permanently.
				</div>
			)}
			{media.bannerSrc && (
				<div className={styles.banner_wrapper}>
					<BannerEditTrigger
						media={media}
						bannerSrc={media.bannerSrc}
						bannerClassName={styles.banner}
						visualClassName={styles.banner_visual}
						imageClassName={styles.banner_image}
						backdropClassName={styles.banner_backdrop}
						grainOpacity={BANNER_GRAIN_OPACITY}
					/>
				</div>
			)}
			{media.bannerSrc && <div className={styles.banner_spacer} />}
			{!media.bannerSrc && <div className={styles.no_banner_spacer} />}

			<div className={styles.details_wrapper}>
				<div className={styles.header}>
					<div className={styles.poster_column}>
						<div className={styles.poster}>
							<PosterEditTrigger
								media={media}
								ratio={posterRatioFor(media.type)}
							/>
							<AddToListButton
								mediaId={media.id}
								allLists={allLists}
								memberListIds={memberListIds}
								className={styles.list_button_float}
							/>
						</div>
						{runtimeLabel && (
							<div className={styles.poster_info}>{runtimeLabel}</div>
						)}
						{session?.user && (
							<div className={styles.controls_bar}>
								<AddToWatchlistButton
									mediaId={media.id}
									initialIsInWatchlist={!!watchlistItem}
								/>
							</div>
						)}
					</div>
					<div className={styles.header_info}>
						<div className={styles.title_row}>
							<div className={styles.title_group}>
								<MediaTitle title={media.title} className={styles.title} />
								{directorEntries.length > 0 && (
									<span className={styles.title_director}>
										by <CreditNames entries={directorEntries} />
									</span>
								)}
							</div>
							<div className={styles.title_actions}>
								<MediaEditButton media={media} className={styles.edit_button} />
							</div>
						</div>
						{media.alternateTitle && (
							<div className={styles.alt_title}>{media.alternateTitle}</div>
						)}

						<div className={styles.meta_row}>
							<MediaReleaseDate date={media.releaseDate} />
							{tagline && <span className={styles.tagline}>{tagline}</span>}
						</div>

						<div className={styles.review_row}>
							<div className={styles.review_col}>
								<ReviewBodyEditTrigger media={media} />
							</div>
							{(publicRating != null ||
								difficulty === 1 ||
								difficulty === 2 ||
								budget != null ||
								revenue != null ||
								roi != null) && (
								<div className={styles.secondary_facts}>
									{publicRating != null && (
										<div className={styles.public_rating}>
											{publicRating.toFixed(1)}
											<StarIcon style={{ color: "var(--link)" }} />
										</div>
									)}
									{(difficulty === 1 || difficulty === 2) && (
										<Tooltip
											content={
												difficulty === 1 ? "Medium difficulty" : "Hard difficulty"
											}>
											<div className={styles.difficulty}>
												<span
													className={`${styles.difficulty_dot} ${difficulty === 1 ? styles.difficulty_dot_medium : styles.difficulty_dot_hard}`}
												/>
												{difficulty === 1 ? "Medium" : "Hard"}
											</div>
										</Tooltip>
									)}
									{(budget != null || revenue != null || roi != null) && (
										<div className={styles.finance_group}>
											<dl className={styles.financials_facts}>
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
											{roi != null && (
												<Tooltip content="Return on investment">
													<CircularGauge
														value={roi}
														size={40}
														strokeWidth={3}
														max={1}
														unit={"x"}
														textScaling={0.35}
													/>
												</Tooltip>
											)}
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</div>

				<section className={styles.section}>
					<h2 className={styles.section_title}>Details</h2>
					{media.overview && (
						<p className={styles.overview}>{media.overview}</p>
					)}

					<MediaTypeFacts media={media} />

					{(actorEntries.length > 0 || studioEntries.length > 0) && (
						<dl className={styles.facts}>
							{actorEntries.length > 0 && (
								<Fact
									label="Cast"
									value={<CastPhotos entries={actorEntries} />}
								/>
							)}
							{studioEntries.length > 0 && (
								<Fact
									label="Studio"
									value={<CreditNames entries={studioEntries} />}
								/>
							)}
						</dl>
					)}

					{otherRoles.length > 0 && (
						<details className={styles.credits}>
							<summary className={styles.credits_summary}>
								Credits
								<span className={styles.credits_count}>
									{otherRoles.length}
								</span>
							</summary>
							<div className={styles.credits_list}>
								{otherRoles.map(([role, entries]) => (
									<div className={styles.credit_row} key={role}>
										<span className={styles.credit_role}>{role}</span>
										<CreditNames entries={[...entries.values()]} />
									</div>
								))}
							</div>
						</details>
					)}
				</section>

				<section className={styles.section}>
					<h2 className={styles.section_title}>Change log</h2>
					<ChangeLogList
						entries={raw.changeLog}
						type={raw.type}
						externalId={raw.externalId}
						review={raw.review}
					/>
				</section>
			</div>
		</div>
	);
}
