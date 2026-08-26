import { notFound } from "next/navigation";
import { CreditMediaListPage } from "@/components/media/media-pages/credit-media-list-page/credit-media-list-page";

// No generateStaticParams, so each id is rendered on first visit and then
// cached indefinitely by default (same on-demand-ISR behavior as /movies
// etc) — but nothing ever calls revalidatePath for this route: credits get
// recreated both when an admin adds media (a Server Action, which could
// revalidate) and when enrich-db.ts re-syncs an existing item's credits (a
// separate GitHub Actions cron process, which can't). This time-based
// revalidate is what keeps a person's filmography from going stale forever
// after their first visit, covering both paths at once — same reasoning as
// get-media.ts's own 1-hour revalidate.
export const revalidate = 3600;

export default async function PersonCreditsPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const personId = Number(id);
	if (!Number.isFinite(personId)) notFound();

	return <CreditMediaListPage kind="person" id={personId} />;
}
