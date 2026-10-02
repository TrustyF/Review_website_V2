"use client";
import { Check } from "lucide-react";
import { Clickable } from "@/components/ui/clickable";
import styles from "./media-selection.module.sass";

type Props = {
	title: string;
	selected: boolean;
	onToggle: () => void;
};

// Sits over a card's poster in select mode; swallows the click so the poster link doesn't navigate.
export function MediaSelectOverlay({ title, selected, onToggle }: Props) {
	return (
		<Clickable
			className={
				selected
					? `${styles.card_overlay} ${styles.card_overlay_selected}`
					: styles.card_overlay
			}
			aria-pressed={selected}
			aria-label={title}
			onClick={onToggle}>
			<span
				className={
					selected ? `${styles.check} ${styles.check_selected}` : styles.check
				}>
				{selected && <Check size={12} strokeWidth={3} />}
			</span>
		</Clickable>
	);
}
