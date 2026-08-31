"use client";
import { useRef, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import {
	MediaSortOption,
	SORT_OPTIONS,
} from "@/components/media/media-grids/media-sort/media-sort";
import { MediaSortIcon } from "@/components/media/media-grids/media-sort/media-sort-icon";
import { useOutsideClick } from "@/lib/use-outside-click";
import { Hitbox } from "@/components/ui/hitbox";
import styles from "./media-sort-popover.module.sass";

type Props = {
	sort: MediaSortOption;
	onChange: (next: MediaSortOption) => void;
};

// Sibling to MediaFilterPopover, but single-select: no clear affordance or count badge, just a dot marking "not the default".
export function MediaSortPopover({ sort, onChange }: Props) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useOutsideClick(containerRef, () => setIsOpen(false), { enabled: isOpen });

	return (
		<div className={styles.wrapper} ref={containerRef}>
			<Hitbox onClick={() => setIsOpen((v) => !v)} padding={15}>
				<div className={styles.trigger}>
					<ArrowUpDown size={16} />
					{sort !== "rating" && <span className={styles.active_dot} />}
				</div>
			</Hitbox>
			{isOpen && (
				<div className={styles.popover}>
					{SORT_OPTIONS.map((option) => {
						function select() {
							onChange(option.value);
							setIsOpen(false);
						}
						return (
							<span
								key={option.value}
								className={styles.option}
								role="button"
								tabIndex={0}
								aria-current={option.value === sort ? "true" : undefined}
								onClick={select}
								onKeyDown={(e) => {
									if (e.key !== "Enter" && e.key !== " ") return;
									e.preventDefault();
									select();
								}}>
								<MediaSortIcon option={option.value} />
								{option.label}
							</span>
						);
					})}
				</div>
			)}
		</div>
	);
}
