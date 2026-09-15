"use client";
import Image from "next/image";
import { Building2, UserRound } from "lucide-react";
import { Link } from "@/components/ui/link";
import { GlobalSearchResult } from "@/components/search/search-actions";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./search-result-card.module.sass";

// One search result component, separate since GlobalSearchResult lacks MediaRecord fields.
export function SearchResultCard({ result }: { result: GlobalSearchResult }) {
	const dict = useDictionary();

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
					{result.creditCount === 1 ? dict.nav.search.credit : dict.nav.search.credits}
				</div>
			</div>
		</Link>
	);
}
