import { Link } from "@/components/ui/link";
import styles from "./unsubscribed.module.sass";

type Props = {
	searchParams: Promise<{ status?: string }>;
};

export default async function UnsubscribedPage({ searchParams }: Props) {
	const { status } = await searchParams;
	const ok = status === "ok";

	return (
		<div className={styles.wrapper}>
			<h1>{ok ? "You're unsubscribed" : "Link invalid or expired"}</h1>
			<p>
				{ok
					? "You won't get this email again. You can turn it back on any time from account settings."
					: "This unsubscribe link couldn't be verified. You can manage your email preferences from account settings."}
			</p>
			<Link href="/account/settings" className={styles.back_link}>
				Account settings
			</Link>
		</div>
	);
}
