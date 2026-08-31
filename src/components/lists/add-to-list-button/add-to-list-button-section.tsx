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
			<AddToListButton
				mediaId={mediaId}
				allLists={[]}
				memberListIds={[]}
				className={className}
			/>
		);
	}

	// Every list plus current membership, so the popover renders pre-checked without a second round trip.
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
