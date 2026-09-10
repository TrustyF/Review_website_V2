import { Link } from "@/components/ui/link";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import styles from "./unsubscribed.module.sass";

type Props = {
	searchParams: Promise<{ status?: string }>;
};

export default async function UnsubscribedPage({ searchParams }: Props) {
	const [{ status }, dict] = await Promise.all([searchParams, getDictionary()]);
	const ok = status === "ok";

	return (
		<div className={styles.wrapper}>
			<h1>{ok ? dict.unsubscribed.title : dict.unsubscribed.titleInvalid}</h1>
			<p>{ok ? dict.unsubscribed.body : dict.unsubscribed.bodyInvalid}</p>
			<Link href="/account/settings" className={styles.back_link}>
				{dict.unsubscribed.accountSettings}
			</Link>
		</div>
	);
}
