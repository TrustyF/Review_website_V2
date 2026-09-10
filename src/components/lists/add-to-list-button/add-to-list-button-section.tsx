import { auth } from "@/auth";
import { db } from "@/server/db/client";
import { AddToListButton } from "./add-to-list-button";

type Props = {
	mediaId: number;
	className?: string | undefined;
};

// Split out with its own <Suspense> boundary so this query doesn't gate the rest of the page; skipped entirely for non-admins.
export async function AddToListButtonSection({ mediaId, className }: Props) {
	const session = await auth();
	if (session?.user?.role !== "ADMIN") {
		return (
			<AddToListButton mediaId={mediaId} memberLists={[]} className={className} />
		);
	}

	// Only the lists this media is already in, via the indexed reverse lookup — the
	// full list catalog is fetched on demand by search instead (see list-actions.ts's searchLists).
	const memberships = await db.listItem.findMany({
		where: { mediaId },
		select: { list: { select: { id: true, title: true } } },
		orderBy: { list: { createDate: "desc" } },
	});
	const memberLists = memberships.map((m) => m.list);

	return (
		<AddToListButton
			mediaId={mediaId}
			memberLists={memberLists}
			className={className}
		/>
	);
}
