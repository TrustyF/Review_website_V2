import { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { toMediaRecord, MediaRecord } from "@/components/media/types";
import { posterRatioFor } from "@/components/media/poster-ratio";
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
import { BANNER_GRAIN_OPACITY } from "@/server/resolvers/poster-resolver";
import styles from "./media-detail.module.sass";
import { CircularGauge } from "@/components/ui/circular-gauge";
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

// Renders the handful of fields that differ between media types — each type
// keeps its data on a different relation (media.movie, media.tvShow, ...),
// so this just picks the right one and lays out whichever fields are set.
function MediaTypeFacts({ media }: { media: MediaRecord }) {
	switch (media.type) {
		case "MOVIE":
		case "SHORT": {
			const { runtime, budget, revenue, tagline } = media.movie;
			const roi =
				budget != null && revenue != null && budget !== 0
					? (revenue - budget) / budget
					: null;
			return (
				<dl className={styles.facts}>
					{tagline && <Fact label="Tagline" value={tagline} />}
					{runtime != null && (
						<Fact
							label="Runtime"
							value={formatRuntime(runtime) ?? `${runtime}m`}
						/>
					)}
					{budget != null && (
						<Fact label="Budget" value={CurrencyFormatter.format(budget)} />
					)}
					{revenue != null && (
						<Fact label="Revenue" value={CurrencyFormatter.format(revenue)} />
					)}
					{roi != null && (
						<CircularGauge
							value={roi}
							size={30}
							strokeWidth={2}
							max={1}
							unit={"x"}
							textScaling={0.35}
						/>
					)}
				</dl>
			);
		}
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
				mediaGenres: { include: { genre: true } },
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

	const memberListIds = allLists
		.filter((list) => list.items.length > 0)
		.map((list) => list.id);

	const genres = raw.mediaGenres.map((mediaGenre) => mediaGenre.genre.name);

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
				}
			: credit.company
				? {
						key: `company-${credit.company.id}`,
						href: `/credits/company/${credit.company.id}${roleQuery}`,
						name: credit.company.name,
						order: credit.order,
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
					<div className={styles.poster}>
						<PosterEditTrigger
							media={media}
							ratio={posterRatioFor(media.type)}
						/>
					</div>
					<div className={styles.header_info}>
						<div className={styles.title_row}>
							<MediaTitle title={media.title} className={styles.title} />
							<AddToListButton
								mediaId={media.id}
								allLists={allLists}
								memberListIds={memberListIds}
							/>
							{session?.user && (
								<AddToWatchlistButton
									mediaId={media.id}
									initialIsInWatchlist={!!watchlistItem}
								/>
							)}
							<MediaEditButton media={media} className={styles.edit_button} />
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
							{raw.sourceUrl && (
								<a
									className={styles.source_link}
									href={raw.sourceUrl}
									target="_blank"
									rel="noopener noreferrer">
									View on {PROVIDER_LABELS[media.type]}
								</a>
							)}
						</div>

						{genres.length > 0 && (
							<div className={styles.genres}>
								{genres.map((genre) => (
									<span className={styles.genre} key={genre}>
										{genre}
									</span>
								))}
							</div>
						)}

						{media.overview && (
							<p className={styles.overview}>{media.overview}</p>
						)}

						<MediaTypeFacts media={media} />

						{(directorEntries.length > 0 ||
							actorEntries.length > 0 ||
							studioEntries.length > 0) && (
							<dl className={styles.facts}>
								{directorEntries.length > 0 && (
									<Fact
										label="Director"
										value={<CreditNames entries={directorEntries} />}
									/>
								)}
								{actorEntries.length > 0 && (
									<Fact
										label="Cast"
										value={<CreditNames entries={actorEntries} />}
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
					</div>
				</div>

				<section className={styles.section}>
					<h2 className={styles.section_title}>Review</h2>
					<ReviewBodyEditTrigger media={media} />
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
