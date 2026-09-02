import { db } from "@/server/db/client";
import { resolveChangelogPosterThumb } from "@/server/resolvers/poster-resolver";
import { sendEmail, toAbsoluteUrl } from "@/server/email/mailer";
import ListAddDigestEmail from "@/emails/list-add-digest-email";
import { appendJobSummary, formatSummaryList } from "./job-summary";

// Slack for cron drift — run daily, but a wider net than exactly 24h means a
// late/early run never leaves a gap between two consecutive windows.
const WINDOW_MS = 25 * 60 * 60 * 1000;

const PLACEHOLDER_POSTER_SRC = "/posters/placeholder.jpg";

// Batches LIST_ITEM_ADDED notifications (not LIST_CREATED — an empty new
// list has no media to show) into one email per recipient per day, grouped
// by list. emailedAt gates which rows are eligible so a cron overlap/retry
// never sends the same addition twice.
async function main() {
	const since = new Date(Date.now() - WINDOW_MS);

	const notifications = await db.notification.findMany({
		where: {
			type: "LIST_ITEM_ADDED",
			emailedAt: null,
			createdAt: { gte: since },
			user: { listAddEmailOptIn: true, email: { not: null } },
		},
		select: {
			id: true,
			userId: true,
			user: { select: { email: true } },
			list: { select: { id: true, title: true } },
			media: {
				select: {
					id: true,
					title: true,
					type: true,
					posterPath: true,
					externalId: true,
				},
			},
		},
	});

	const eligible = notifications.filter((n) => n.list && n.media);
	if (eligible.length === 0) {
		await appendJobSummary(["No list additions to email — skipped."]);
		return;
	}

	const byUser = new Map<string, typeof eligible>();
	for (const n of eligible) {
		const group = byUser.get(n.userId);
		if (group) group.push(n);
		else byUser.set(n.userId, [n]);
	}

	let sentCount = 0;
	for (const [, userNotifications] of byUser) {
		const email = userNotifications[0]!.user.email!;

		const byList = new Map<
			number,
			{ listId: number; title: string; items: typeof userNotifications }
		>();
		for (const n of userNotifications) {
			const list = n.list!;
			const group = byList.get(list.id);
			if (group) group.items.push(n);
			else byList.set(list.id, { listId: list.id, title: list.title, items: [n] });
		}

		const lists = await Promise.all(
			[...byList.values()].map(async (group) => ({
				listId: group.listId,
				title: group.title,
				listUrl: toAbsoluteUrl(`/lists/${group.listId}`),
				items: await Promise.all(
					group.items.map(async (n) => {
						const media = n.media!;
						const posterSrc = media.posterPath
							? await resolveChangelogPosterThumb(
									media.id,
									media.type,
									media.externalId,
									media.posterPath,
								)
							: PLACEHOLDER_POSTER_SRC;
						return {
							title: media.title,
							mediaUrl: toAbsoluteUrl(`/media/${media.id}`),
							posterSrc: toAbsoluteUrl(posterSrc),
							rating: null,
						};
					}),
				),
			})),
		);

		await sendEmail({
			to: email,
			subject: "New picks added to your lists",
			react: ListAddDigestEmail({ lists, accountUrl: toAbsoluteUrl("/account/settings") }),
		});
		// Marked right after this user's own send succeeds, not batched at the
		// end — if a later user's send throws, everyone already emailed stays
		// marked instead of getting double-emailed on the next retry.
		await db.notification.updateMany({
			where: { id: { in: userNotifications.map((n) => n.id) } },
			data: { emailedAt: new Date() },
		});
		sentCount++;
	}

	await appendJobSummary([
		`Sent list-add digest to ${sentCount} user(s), ${eligible.length} addition(s) total.`,
		...formatSummaryList([...byUser.keys()]),
	]);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
