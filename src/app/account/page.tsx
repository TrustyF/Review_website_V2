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
import styles from "./account.module.sass";

export default async function AccountPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/login");

	// role comes straight off the session (JWT) — see auth.ts's own comment,
	// it deliberately only refreshes on sign-in. image/username read from
	// the DB instead of the session, though: updateAvatar/
	// updateAccountSettings write those straight to the DB without touching
	// the JWT, so reading them from the session here would show this page
	// disagreeing with whatever the user just picked/saved.
	// preferredLanguage/newsletterOptIn moved to /account/settings — not
	// needed on this page anymore.
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

	// Admin-curated recommendation lists deposited into this account — see
	// List.targetUserId's own comment in list.prisma. Same shape ListsOverviewPage
	// queries with, just scoped to this one recipient instead of the public set.
	// Fixed at 4 (2x2) rather than however many happen to fit — matches
	// WatchlistStack's own MAX_VISIBLE reasoning, this is a preview not an
	// exhaustive list.
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
						aria-label="Account settings">
						<Settings size={18} />
					</Link>
					<SignOutButton />
				</div>
			</div>

			<div className={styles.grid}>
				<Link href="/watchlist" className={styles.watchlist}>
					<h2 className={styles.section_title}>
						<WatchlistIcon size={18} className={styles.section_icon} />
						Watchlist
					</h2>
					{watchlistMedia.length === 0 ? (
						<p className={styles.empty}>
							Your watchlist is empty — add something from its media page.
						</p>
					) : (
						<WatchlistStack media={watchlistMedia} />
					)}
				</Link>
				<Link href="/account/lists" className={styles.lists}>
					<h2 className={styles.section_title}>
						<List size={18} className={styles.section_icon} />
						Recommendations
					</h2>
					{recommendationLists.length === 0 ? (
						<p className={styles.empty}>
							Nothing recommended yet — lists an admin curates for you
							specifically will show up here.
						</p>
					) : (
						<div className={styles.lists_stack}>
							{recommendationLists.map((list) => (
								<ListPreviewCard
									key={list.id}
									id={list.id}
									title={list.title}
									description={list.description}
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
