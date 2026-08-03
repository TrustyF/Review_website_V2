import { CSSProperties, MouseEvent, ReactNode } from "react";
import styles from "./hitbox.module.sass";

type Props = {
	onClick: (e: MouseEvent<HTMLButtonElement>) => void;
	children: ReactNode;
	/** Extra clickable margin around the child, in px. */
	padding?: number;
	className?: string | undefined;
	style?: CSSProperties | undefined;
};

// Wraps `children` in a box sized/positioned via className/style (same as
// you'd style the child directly), then lays an invisible <button> on top of
// it, inset by `padding`. The child itself is never touched — no
// cloneElement, no CSS specificity games, nothing that can drift out of
// sync with whatever the child's own markup happens to be.
export function Hitbox({
	onClick,
	children,
	padding = 0,
	className,
	style,
}: Props) {
	return (
		<div
			className={[className].filter(Boolean).join(" ")}
			style={style}
		>
			{children}
			<button
				type="button"
				className={styles.hit_area}
				style={{ inset: -padding }}
				onClick={onClick}
			/>
		</div>
	);
}
