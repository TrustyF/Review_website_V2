import { MediaType, Review } from "@prisma/client";
import { ChangeLogList } from "@/components/media/media-management/change-log/change-log-list";
import { getMediaChangeLog } from "./get-media";

type Props = {
	mediaId: number;
	type: MediaType;
	externalId: string | null;
	review: Review | null | undefined;
};

// Split into its own component (and <Suspense> boundary, see page.tsx) so
// the change-log query doesn't gate the rest of the page — type/externalId/
// review come from page.tsx's own getMediaCore result (already resolved by
// the time this renders), only the entries themselves are fetched here.
export async function MediaChangeLogSection({
	mediaId,
	type,
	externalId,
	review,
}: Props) {
	const entries = await getMediaChangeLog(mediaId);

	return (
		<ChangeLogList
			entries={entries}
			type={type}
			externalId={externalId}
			review={review}
		/>
	);
}
