import type { Metadata } from "next";
import { Link } from "@/components/ui/link";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import styles from "./error-page.module.sass";

export async function generateMetadata(): Promise<Metadata> {
	const dict = await getDictionary();
	return { title: dict.errorPage.notFoundTitle };
}

export default async function NotFound() {
	const dict = await getDictionary();
	return (
		<div className={styles.wrapper}>
			<div className={styles.code}>404</div>
			<h1>{dict.errorPage.notFoundTitle}</h1>
			<p>{dict.errorPage.notFoundBody}</p>
			<Link href="/" className={styles.button}>
				{dict.errorPage.home}
			</Link>
		</div>
	);
}
