import { CSSProperties, SVGProps } from "react";

const DEFAULT_STYLE: CSSProperties = {
	color: "var(--accent1)",
	marginTop: "-0.1rem",
	aspectRatio: "1",
	objectFit: "scale-down",
};

type Props = SVGProps<SVGSVGElement> & {
	size?: number;
};

export function ReviewIcon({ style, size = 15, ...props }: Props) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			role="graphics-symbol"
			width={size}
			height={size}
			viewBox="0 0 8 8"
			aria-label="Review"
			style={{ ...DEFAULT_STYLE, ...style }}
			{...props}>
			<path
				fill="currentColor"
				fillRule="evenodd"
				d="M0 0H8V1.5H0zM0 3H8V4.5H0zM0 6H5V5.5H0z"
			/>
		</svg>
	);
}
