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
				d="M21,49c1,1,11.688-6.26933,24-21a22.321,22.321,0,0,0,4-7c.89194-2.5592,2.78682-7.99612,0-12a10.206,10.206,0,0,0-8-4c-7.03047-.14908-15,7-15,7-.4571-1.15036-3.13-7.56143-10-10C14.4879,1.46327,9.87975-.17244,6,2-.00115,5.3603-.18,15.54745,2,22c.77769,2.30188,1.682,3.61487,4,7C18.956,47.92083,20,48,21,49Z"
			/>
		</svg>
	);
}
