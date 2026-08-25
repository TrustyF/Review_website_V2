import { redirect } from "next/navigation";
import Link from "next/link";
import { List, Settings } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { toMediaRecord } from "@/components/media/types";
import { AvatarPicker } from "@/components/account/avatar-picker/avatar-picker";
import { getAvatarGroups } from "@/server/avatars/avatar-catalog";
import { WatchlistStack } from "@/components/watchlist/watchlist-stack/watchlist-stack";
import { WatchlistIcon } from "@/components/icons/watchlist-icon";
import styles from "./account.module.sass";

export default async function AccountPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/login");

	// role comes straight off the session (JWT) — see auth.ts's own comment,
	// it deliberately only refreshes on sign-in. image read from the DB
	// instead of the session, though: updateAvatar writes it straight to the
	// DB without touching the JWT, so reading it from the session here would
	// show this page disagreeing with whatever the user just picked.
	// preferredLanguage/newsletterOptIn moved to /account/settings — not
	// needed on this page anymore.
	const user = await db.user.findUnique({
		where: { id: session.user.id },
		select: { image: true },
	});
	if (!user) redirect("/login");

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

	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>
				<AvatarPicker initialSrc={user.image} groups={getAvatarGroups()} />
				<div className={styles.identity}>
					<h1 className={styles.name}>{session.user.name ?? session.user.email}</h1>
					{session.user.name && (
						<p className={styles.email}>{session.user.email}</p>
					)}
					<p className={styles.role}>
						{session.user.role === "ADMIN" ? "Admin" : "Member"}
					</p>
				</div>
				<Link
					href="/account/settings"
					className={styles.settings_link}
					aria-label="Account settings">
					<Settings size={18} />
				</Link>
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
				{/* No per-user ownership on List yet (see prisma/schema/list.prisma
				— lists are still admin-curated/site-wide) — this is a placeholder
				for the planned "admin deposits a recommendation list into a
				user's account" feature, not wired to real data yet. */}
				<section className={styles.lists}>
					<h2 className={styles.section_title}>
						<List size={18} className={styles.section_icon} />
						Lists
					</h2>
					<p className={styles.empty}>Coming soon.</p>
				</section>
			</div>
		</div>
	);
}
