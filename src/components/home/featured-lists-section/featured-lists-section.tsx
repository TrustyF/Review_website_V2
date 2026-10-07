import { db } from "@/server/db/client";
import { ListPreviewCard } from "@/components/lists/list-preview-card/list-preview-card";
import { HomeSectionHeader } from "@/components/home/home-section-header";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getLocale } from "@/lib/i18n/get-locale";
import sectionStyles from "@/components/home/home-section.module.sass";
import styles from "./featured-lists-section.module.sass";

const FEATURED_LISTS_COUNT = 4;
const NEW_LIST_DAYS = 14;

// Public lists created in the last NEW_LIST_DAYS (same targetUserId: null scope as /lists); hidden when there are none.
export async function FeaturedListsSection() {
	const since = new Date();
	since.setDate(since.getDate() - NEW_LIST_DAYS);
	const [lists, dict, locale] = await Promise.all([
		db.list.findMany({
			where: {
				targetUserId: null,
				items: { some: {} },
				createDate: { gte: since },
			},
			include: { _count: { select: { items: true } } },
			orderBy: { createDate: "desc" },
			take: FEATURED_LISTS_COUNT,
		}),
		getDictionary(),
		getLocale(),
	]);
	if (lists.length === 0) return null;

	return (
		<section className={sectionStyles.wrapper}>
			<HomeSectionHeader
				title={dict.home.newLists}
				seeAll={{ href: "/lists", label: dict.home.seeAll }}
			/>
			<div className={`${sectionStyles.body} ${styles.grid}`}>
				{lists.map((list) => (
					<ListPreviewCard
						key={list.id}
						id={list.id}
						// Falls back to English when untranslated, like ListsOverviewPage.
						title={locale === "fr" ? (list.titleFr ?? list.title) : list.title}
						description={null}
						thumbnail={list.thumbnail}
						itemCount={list._count.items}
					/>
				))}
			</div>
		</section>
	);
}
