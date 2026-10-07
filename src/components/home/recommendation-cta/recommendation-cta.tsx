import { MessageSquareHeart } from "lucide-react";
import { Link } from "@/components/ui/link";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import styles from "./recommendation-cta.module.sass";

type Props = {
	signedIn: boolean;
};

// Signed-out visitors go through /login first, since a request needs an account.
export async function RecommendationCta({ signedIn }: Props) {
	const dict = await getDictionary();

	return (
		<section className={styles.card}>
			<MessageSquareHeart size={22} className={styles.icon} />
			<h2 className={styles.title}>{dict.home.recommendationCtaTitle}</h2>
			<p className={styles.text}>{dict.recommendationRequest.subtitle}</p>
			<Link
				href={signedIn ? "/account/recommendation-request" : "/login"}
				className={styles.button}>
				{dict.home.recommendationCtaButton}
			</Link>
		</section>
	);
}
