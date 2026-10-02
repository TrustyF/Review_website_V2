import { CSSProperties, SVGProps } from "react";

const DEFAULT_STYLE: CSSProperties = {
	color: "var(--danger)",
	aspectRatio: "1",
	objectFit: "scale-down",
};

type Props = SVGProps<SVGSVGElement> & {
	size?: number;
	// SVG <title> child, not aria-label override — browsers show it as a native hover tooltip.
	title?: string;
};

export function HeartIcon({ style, size = 15, title, ...props }: Props) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			role="graphics-symbol"
			width={size}
			height={size}
			viewBox="0 0 51 50"
			aria-label="♥"
			style={{ ...DEFAULT_STYLE, ...style }}
			{...props}>
			{title && <title>{title}</title>}
			<path
				fill="currentColor"
				fillRule="evenodd"
				clipRule="evenodd"
				d="M21 49c5-3 17-11 24-21a22.321 22.321 0 004-7c.8919-2.5592 2.7868-7.9961 0-12-3-5-13-11-24 11C22-1 9.8797-.1724 6 2-.0011 5.3603-.18 15.5474 2 22c3 8 15 24 19 27Z"
			/>
		</svg>
	);
}
