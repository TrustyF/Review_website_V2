import { CSSProperties, SVGProps } from "react";

const DEFAULT_STYLE: CSSProperties = {
	color: "var(--accent1)",
	marginTop: "-0.1rem",
	aspectRatio: "1",
	objectFit: "scale-down",
};

type Props = SVGProps<SVGSVGElement> & {
	size?: number;
	// Rendered as an SVG <title> child rather than an aria-label override —
	// browsers show that as a native hover tooltip (e.g. a review body
	// preview), which aria-label alone doesn't do.
	title?: string;
};

export function ReviewIcon({ style, size = 15, title, ...props }: Props) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			role="graphics-symbol"
			width={size}
			height={size}
			viewBox="0 0 10 10"
			aria-label="Review"
			style={{ ...DEFAULT_STYLE, ...style }}
			{...props}>
			{title && <title>{title}</title>}
			<path
				fill="currentColor"
				fillRule="evenodd"
				clipRule="evenodd"
				d="m0 1c0-.5523.4477-1 1-1h12c.5523 0 1 .4477 1 1s-.4477 1-1 1h-12c-.5523 0-1-.4477-1-1m0 4c0-.5523.4477-1 1-1h12c.5523 0 1 .4477 1 1s-.4477 1-1 1h-12c-.5523 0-1-.4477-1-1m0 4c0-.5523.4477-1 1-1h5c.5523 0 1 .4477 1 1s-.4477 1-1 1h-5c-.5523 0-1-.4477-1-1z"
			/>
		</svg>
	);
}
