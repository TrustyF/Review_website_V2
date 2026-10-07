import { ReactNode } from "react";
import { Link } from "@/components/ui/link";
import styles from "./home-section.module.sass";

type Props = {
	title: ReactNode;
	// Omitted when the section has no page of its own to link to.
	seeAll?: { href: string; label: string };
	action?: ReactNode | undefined;
};

// Hook-free, so both server and client sections can render it.
export function HomeSectionHeader({ title, seeAll, action }: Props) {
	return (
		<div className={styles.header}>
			<h2 className={styles.title}>{title}</h2>
			{action}
			{seeAll && (
				<Link href={seeAll.href} className={styles.see_all}>
					{seeAll.label}
				</Link>
			)}
		</div>
	);
}
