import { db } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/media-card/types";
import { MediaCardResolver } from "@/components/media/media-card/media-card-resolver";
import { EnrichmentStatus, MediaType } from "@prisma/client";
import { notFound } from "next/navigation";
import styles from "./media-cards-dev.module.sass";

// Random picks are made per-request — without this Next would prerender
// the page once at build time and every reload would show the same items.
export const dynamic = "force-dynamic";

// Card components implemented so far — extend as more get built out.
const IMPLEMENTED_TYPES: MediaType[] = [
	MediaType.MOVIE,
	MediaType.SHORT,
	MediaType.TVSHOW,
];

// Plain helper (not a component), so the impure Math.random() call here
// doesn't trip react-hooks' render-purity check.
function pickRandom<T>(items: T[]): T | undefined {
	return items[Math.floor(Math.random() * items.length)];
}

export default async function MediaCardsDevPage() {
	if (process.env.NODE_ENV !== "development") notFound();

	const sections = await Promise.all(
		Object.values(MediaType).map(async (type) => {
			const candidates = await db.media.findMany({
				where: { type, enrichmentStatus: EnrichmentStatus.DONE },
				include: {
					movie: true,
					tvShow: true,
					manga: true,
					comic: true,
					game: true,
					review: true,
				},
			});

			const raw = pickRandom(candidates);
			if (!raw) return { type, media: null };

			return { type, media: await toMediaRecord(raw) };
		}),
	);

	return (
		<div className={styles.wrapper}>
			<h1>Media card preview</h1>
			<p>One random, enriched media item per type — reload to reroll.</p>
			<div className={styles.sections}>
				{sections.map(({ type, media }) => (
					<div
						className={styles.section}
						key={type}
					>
						<h2>{type}</h2>
						{!media && (
							<p className={styles.note}>
								No enriched media of this type in the DB.
							</p>
						)}
						{media && !IMPLEMENTED_TYPES.includes(type) && (
							<p className={styles.note}>Card not implemented yet.</p>
						)}
						{media && IMPLEMENTED_TYPES.includes(type) && (
							<MediaCardResolver media={media} />
						)}
					</div>
				))}
			</div>
		</div>
	);
}
