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
				d="m0 0h10v2H0zm0 4h9v2H0zM5 8H0v2h5Z"
			/>
		</svg>
	);
}
