"use client";
import { Link } from "@/components/ui/link";
import { usePathname } from "next/navigation";
import { isNavActive } from "@/lib/nav-active";
import { Tip } from "@/components/tips/tip/tip";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./media-type-switcher.module.sass";

type Item = { href: string; label: string };

// Lets a catalog page (e.g. /movies) jump to its sibling types (/tv, /shorts)
// now that the navbar only links to the group ("Media"/"Reading") as a whole.
export function MediaTypeSwitcher({ items }: { items: Item[] }) {
	const pathname = usePathname();
	const dict = useDictionary();
	return (
		<div className={styles.tabs}>
			{items.map((item, i) => {
				const isActive = isNavActive(pathname, item.href);
				const tab = (
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
				// Tip sits beside the last tab, pointing back along the row.
				return i === items.length - 1 ? (
					<Tip
						key={item.href}
						id="mediaTypeSwitcher"
						text={dict.tips.mediaTypeSwitcher}
						side="right">
						{tab}
					</Tip>
				) : (
					tab
				);
			})}
		</div>
	);
}
