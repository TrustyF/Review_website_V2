import { redirect } from "next/navigation";
import { Link } from "@/components/ui/link";
import { auth } from "@/auth";
import { getMyRecommendationRequests } from "@/components/recommendations/recommendation-request-actions";
import { RecommendationRequestPageClient } from "@/components/recommendations/recommendation-request-page-client";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import styles from "./recommendation-request.module.sass";

export default async function RecommendationRequestPage() {
	const session = await auth();
	if (!session?.user?.id) redirect("/login");

	const [requests, dict] = await Promise.all([
		getMyRecommendationRequests(),
		getDictionary(),
	]);

	return (
		<div className={styles.wrapper}>
			<Link href="/account" className={styles.back_link}>
				{dict.recommendationRequest.backToAccount}
			</Link>
			<h1>{dict.recommendationRequest.title}</h1>
			<p className={styles.subtitle}>{dict.recommendationRequest.subtitle}</p>
			<RecommendationRequestPageClient initialRequests={requests} />
		</div>
	);
}
