import { CSSProperties, MouseEvent, ReactNode } from "react";
import styles from "./hitbox.module.sass";

type Props = {
	onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
	onMouseEnter?: () => void;
	onMouseLeave?: () => void;
	children: ReactNode;
	/** Extra hit margin around the child, in px. */
	padding?: number;
	className?: string | undefined;
	style?: CSSProperties | undefined;
};

// Wraps `children` in a box sized/positioned via className/style (same as
// you'd style the child directly), then lays an invisible hit area on top
// of it, inset by `padding` — bigger than the child's own visible bounds,
// so a small or oddly-shaped target is still easy to click and/or hover
// accurately (see Tooltip's own hitboxPadding, which reuses this for a
// hover-only target). Renders a real <button> only when onClick is given,
// since that needs to be a focusable, keyboard-activatable element — a
// plain <div> otherwise. That matters beyond semantics: a <button> with no
// click handler, sitting inside an <a> (as Tooltip's difficulty-notch usage
// does, nested in MediaPoster's own Link), would be invalid interactive-
// inside-interactive markup. The child itself is never touched — no
// cloneElement, no CSS specificity games, nothing that can drift out of
// sync with whatever the child's own markup happens to be.
export function Hitbox({
	onClick,
	onMouseEnter,
	onMouseLeave,
	children,
	padding = 0,
	className,
	style,
}: Props) {
	return (
		<div className={[className].filter(Boolean).join(" ")} style={style}>
			{children}
			{onClick ? (
				<button
					type="button"
					className={styles.hit_area}
					style={{ inset: -padding }}
					onClick={onClick}
					onMouseEnter={onMouseEnter}
					onMouseLeave={onMouseLeave}
				/>
			) : (
				<div
					className={styles.hit_area}
					style={{ inset: -padding }}
					onMouseEnter={onMouseEnter}
					onMouseLeave={onMouseLeave}
				/>
			)}
		</div>
	);
}
