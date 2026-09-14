"use client";
import { Link } from "@/components/ui/link";
import { usePathname } from "next/navigation";
import { isNavActive } from "@/lib/nav-active";
import styles from "./media-type-switcher.module.sass";

type Item = { href: string; label: string };

// Lets a catalog page (e.g. /movies) jump to its sibling types (/tv, /shorts)
// now that the navbar only links to the group ("Media"/"Reading") as a whole.
export function MediaTypeSwitcher({ items }: { items: Item[] }) {
	const pathname = usePathname();
	return (
		<div className={styles.tabs}>
			{items.map((item) => {
				const isActive = isNavActive(pathname, item.href);
				return (
					<Link
						key={item.href}
						href={item.href}
						className={styles.tab}
						aria-current={isActive ? "page" : undefined}
						data-active={isActive}
						prefetch>
						{item.label}
					</Link>
				);
			})}
		</div>
	);
}
