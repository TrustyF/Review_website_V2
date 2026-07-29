import { SVGProps } from "react";

export function StarIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			role="graphics-symbol"
			width="15"
			height="15"
			viewBox="0 0 15 15"
			aria-label="★"
			{...props}
		>
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
