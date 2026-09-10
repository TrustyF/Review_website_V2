import { redirect } from "next/navigation";
import { Link } from "@/components/ui/link";
import { List, Settings } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/types";
import { AvatarPicker } from "@/components/account/avatar-picker/avatar-picker";
import { SignOutButton } from "@/components/account/sign-out-button/sign-out-button";
import { getAvatarGroups } from "@/server/avatars/avatar-catalog";
import { WatchlistStack } from "@/components/watchlist/watchlist-stack/watchlist-stack";
import { WatchlistIcon } from "@/components/icons/watchlist-icon";
import { ListPreviewCard } from "@/components/lists/list-preview-card/list-preview-card";
import { displayName } from "@/lib/display-name";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getLocale } from "@/lib/i18n/get-locale";
import styles from "./account.module.sass";

export default async function AccountPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/login");
	const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

	// image/username read from DB (not session) since avatar/settings updates write DB directly without refreshing the JWT.
	const user = await db.user.findUnique({
		where: { id: session.user.id },
		select: { image: true, username: true },
	});
	if (!user) redirect("/login");

	const heading = displayName({
		username: user.username,
		name: session.user.name,
		email: session.user.email,
	});

	const watchlistItems = await db.watchlistItem.findMany({
		where: { userId: session.user.id },
		orderBy: { addedAt: "desc" },
		include: {
			media: {
				include: {
					movie: true,
					tvShow: true,
					manga: true,
					comic: true,
					game: true,
					book: true,
					review: true,
					mediaGenres: { include: { genre: true } },
				},
			},
		},
	});
	const watchlistMedia = watchlistItems
		.filter((item) => !item.media.isDeleted)
		.map((item) => toMediaRecord(item.media));

	// Admin-curated lists targeted at this user; capped to 4 (2x2) as a preview, not the full set.
	const MAX_VISIBLE_LISTS = 4;
	const recommendationListsAll = await db.list.findMany({
		where: { targetUserId: session.user.id },
		include: { _count: { select: { items: true } } },
		orderBy: { createDate: "desc" },
	});
	const recommendationLists = recommendationListsAll.slice(0, MAX_VISIBLE_LISTS);

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<AvatarPicker initialSrc={user.image} groups={getAvatarGroups()} />
				<div className={styles.identity}>
					<h1 className={styles.name}>{heading}</h1>
					{heading !== session.user.email && (
						<p className={styles.email}>{session.user.email}</p>
					)}
					{/*<p className={styles.role}>*/}
					{/*	{session.user.role === "ADMIN" ? "Admin" : "Member"}*/}
					{/*</p>*/}
				</div>
				<div className={styles.header_actions}>
					<Link
						href="/account/settings"
						className={styles.settings_link}
						aria-label={dict.account.settingsAriaLabel}>
						<Settings size={18} />
					</Link>
					<SignOutButton />
				</div>
			</div>

			<div className={styles.grid}>
				<Link href="/watchlist" className={styles.watchlist}>
					<h2 className={styles.section_title}>
						<WatchlistIcon size={18} className={styles.section_icon} />
						{dict.account.watchlistCard}
					</h2>
					{watchlistMedia.length === 0 ? (
						<p className={styles.empty}>{dict.watchlist.empty}</p>
					) : (
						<WatchlistStack media={watchlistMedia} />
					)}
				</Link>
				<Link href="/account/lists" className={styles.lists}>
					<h2 className={styles.section_title}>
						<List size={18} className={styles.section_icon} />
						{dict.account.recommendations}
					</h2>
					{recommendationLists.length === 0 ? (
						<p className={styles.empty}>{dict.account.recommendationsEmpty}</p>
					) : (
						<div className={styles.lists_stack}>
							{recommendationLists.map((list) => (
								<ListPreviewCard
									key={list.id}
									id={list.id}
									// Falls back to English when untranslated, like Review.bodyFr.
									title={locale === "fr" ? (list.titleFr ?? list.title) : list.title}
									description={
										locale === "fr"
											? (list.descriptionFr ?? list.description)
											: list.description
									}
									thumbnail={list.thumbnail}
									itemCount={list._count.items}
									linked={false}
								/>
							))}
						</div>
					)}
				</Link>
			</div>
		</div>
	);
}
