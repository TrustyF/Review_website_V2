import { MediaType, Review } from "@prisma/client";
import { ChangeLogList } from "@/components/media/media-management/change-log/change-log-list";
import { getMediaChangeLog } from "./get-media";

type Props = {
	mediaId: number;
	type: MediaType;
	externalId: string | null;
	review: Review | null | undefined;
};

// Split into own <Suspense> boundary so change-log query doesn't gate rest of page. Type/externalId/review already resolved; only entries fetched here.
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
