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

// Sized box with invisible hit area inset by padding for easier click/hover. Renders <button> only when onClick; <div> otherwise (key: <button> without handler inside <a> is invalid).
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
