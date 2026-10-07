import { ComponentType, ReactNode } from "react";
import { Link } from "@/components/ui/link";
import styles from "./home-section.module.sass";

export type SectionIcon = ComponentType<{
	size?: number;
	className?: string;
}>;

type Props = {
	title: ReactNode;
	// Shown after the title; lucide icons and src/components/icons both fit.
	icon?: SectionIcon | undefined;
	// One-line description under the title.
	subtitle?: ReactNode | undefined;
	// Omitted when the section has no page of its own to link to.
	seeAll?: { href: string; label: string };
	action?: ReactNode | undefined;
};

// Hook-free, so both server and client sections can render it.
export function HomeSectionHeader({
	title,
	icon: Icon,
	subtitle,
	seeAll,
	action,
}: Props) {
	return (
		<div className={styles.header}>
			<div className={styles.heading}>
				<h2 className={styles.title}>
					{title}
					{Icon && <Icon size={22} className={`${styles.icon}`} />}
				</h2>
				{/* Always rendered, so every header is the same height with or without one. */}
				<p
					className={styles.subtitle}
					aria-hidden={subtitle ? undefined : true}>
					{subtitle}
				</p>
			</div>
			{action}
			{seeAll && (
				<Link href={seeAll.href} className={styles.see_all}>
					{seeAll.label}
				</Link>
			)}
		</div>
	);
}
