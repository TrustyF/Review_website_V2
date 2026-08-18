import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { AddToListButton } from "./add-to-list-button";

type Props = {
	mediaId: number;
	className?: string | undefined;
};

// Split out of media/[id]/page.tsx so this query doesn't gate the rest of
// the page's own render — wrapped in its own <Suspense> boundary there, it
// only ever blocks this one small popover trigger, not the banner/title/
// credits/change-log content that only needs getMedia's own result. Also
// skips the query entirely for non-admins: AddToListButton only ever renders
// for an admin (its own client-side useIsAdmin gate), and that gate reads
// the same next-auth session this server-side auth() does, so a signed-out
// or non-admin visitor never pays for a query whose result they'd never see.
export async function AddToListButtonSection({ mediaId, className }: Props) {
	const session = await auth();
	if (session?.user?.role !== "ADMIN") {
		return (
			<AddToListButton
				mediaId={mediaId}
				allLists={[]}
				memberListIds={[]}
				className={className}
			/>
		);
	}

	// Every list, plus which ones (if any) already have this media, so the
	// popover can render pre-checked checkboxes without a second round trip
	// once it opens.
	const allLists = await db.list.findMany({
		select: {
			id: true,
			title: true,
			items: { where: { mediaId }, select: { mediaId: true } },
		},
		orderBy: { createDate: "desc" },
	});
	const memberListIds = allLists
		.filter((list) => list.items.length > 0)
		.map((list) => list.id);

	return (
		<AddToListButton
			mediaId={mediaId}
			allLists={allLists}
			memberListIds={memberListIds}
			className={className}
		/>
	);
}
