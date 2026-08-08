import { CSSProperties, SVGProps } from "react";

// Every caller was redefining the same color and baseline nudge on their own
// .rating_star class — pulled in here as the default instead, so a plain
// <StarIcon /> already looks right and a caller only needs its own style for
// something that's actually context-specific, like the mini card's smaller
// size (see media-mini-card-shell.module.sass's .rating_star).
const DEFAULT_STYLE: CSSProperties = {
	color: "#FCCA00",
	marginTop: "-0.1rem",
	aspectRatio: "1",
	objectFit: "scale-down",
};

type Props = SVGProps<SVGSVGElement> & {
	// Drives both width and height together — a plain CSS width override
	// would fight DEFAULT_STYLE's inline color/margin (inline style always
	// wins over a class, same reason marginTop needed its own override in
	// media-mini-card-shell.tsx), and a width-only override risked distorting
	// the star if height didn't follow. A prop sidesteps both.
	size?: number;
};

export function StarIcon({ style, size = 15, ...props }: Props) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			role="graphics-symbol"
			width={size}
			height={size}
			viewBox="0 0 15 15"
			aria-label="★"
			style={{ ...DEFAULT_STYLE, ...style }}
			{...props}>
			<path
				fill="currentColor"
				fillRule="evenodd"
				stroke="currentColor"
				strokeWidth={0}
				strokeLinejoin="round"
				d="M7.89 1.2c-.34-.95-1.47-.92-1.78 0L4.97 5h-3.9C-.05 5-.39 6.15.53 6.85L3.63 9l-1.18 4.11c-.35 1.13.52 1.8 1.44 1.1L7 11.83l3.11 2.38c.92.7 1.79.03 1.44-1.1L10.37 9l3.1-2.15c.92-.7.58-1.85-.54-1.85H9.08z"
			/>
		</svg>
	);
}
