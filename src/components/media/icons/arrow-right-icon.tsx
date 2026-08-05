import { SVGProps } from "react";

export function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			role="graphics-symbol"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			aria-label="→"
			{...props}
		>
			<path
				stroke="currentColor"
				strokeWidth={3}
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M6 12H18M18 12L13 7M18 12L13 17"
			/>
		</svg>
	);
}
