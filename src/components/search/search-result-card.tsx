import Image from "next/image";
import { Building2, UserRound } from "lucide-react";
import { MediaType } from "@prisma/client";
import { Link } from "@/components/ui/link";
import { GlobalSearchResult } from "@/components/search/search-actions";
import styles from "./search-result-card.module.sass";

const TYPE_LABELS: Record<MediaType, string> = {
	[MediaType.MOVIE]: "Movie",
	[MediaType.SHORT]: "Short",
	[MediaType.TVSHOW]: "TV Show",
	[MediaType.MANGA]: "Manga",
	[MediaType.COMIC]: "Comic",
	[MediaType.GAME]: "Game",
	[MediaType.BOOK]: "Book",
};

// One /search result — a poster tile for media, a photo row for people and
// companies. Kept as its own component (rather than reusing a MediaRecord-
// based card) since GlobalSearchResult's lightweight shape has none of the
// fields those cards need (review, genres, watchedDate, ...).
export function SearchResultCard({ result }: { result: GlobalSearchResult }) {
	if (result.kind === "media") {
		return (
			<Link href={`/media/${result.id}`} className={styles.media_card}>
				<Image
					src={result.posterSrc}
					alt=""
					width={220}
					height={330}
					className={styles.media_poster}
				/>
				<div className={styles.media_title}>{result.title}</div>
				<div className={styles.media_meta}>
					{TYPE_LABELS[result.type]}
					{result.releaseDate && (
						<> · {new Date(result.releaseDate).getFullYear()}</>
					)}
				</div>
			</Link>
		);
	}

	const href =
		result.kind === "person"
			? `/credits/person/${result.id}`
			: `/credits/company/${result.id}`;

	return (
		<Link href={href} className={styles.entity_row}>
			{result.kind === "person" && result.photoSrc ? (
				<Image
					src={result.photoSrc}
					alt=""
					width={56}
					height={70}
					className={styles.entity_photo}
				/>
			) : (
				<span className={styles.entity_photo_placeholder}>
					{result.kind === "company" ? (
						<Building2 size={22} />
					) : (
						<UserRound size={22} />
					)}
				</span>
			)}
			<div className={styles.entity_info}>
				<div className={styles.entity_name}>{result.name}</div>
				<div className={styles.entity_meta}>
					{result.mainRole} · {result.creditCount}{" "}
					{result.creditCount === 1 ? "credit" : "credits"}
				</div>
			</div>
		</Link>
	);
}
