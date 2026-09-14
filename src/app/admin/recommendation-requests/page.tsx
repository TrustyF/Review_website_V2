import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getRecommendationRequestsForAdmin } from "@/components/recommendations/recommendation-request-actions";
import { RecommendationRequestsPanel } from "./recommendation-requests-panel";
import styles from "./recommendation-requests.module.sass";

export default async function AdminRecommendationRequestsPage() {
	const session = await auth();
	if (session?.user?.role !== "ADMIN") notFound();

	const requests = await getRecommendationRequestsForAdmin();

	return (
		<div className={styles.wrapper}>
			<h1>Recommendation requests</h1>
			<RecommendationRequestsPanel initialRequests={requests} />
		</div>
	);
}
