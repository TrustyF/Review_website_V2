type Props = {
	size?: number | undefined;
	className?: string | undefined;
	// Matches the fill prop lucide icons take, so this drops into NavLink's
	// existing `fill={isActive ? "currentColor" : "none"}` call site unchanged.
	fill?: string | undefined;
};

// Extracted from lucide-react's House icon so the filled variant below can be
// hand-edited independently of the outline — lucide only ships outline
// artwork, no separate filled set.
export function HomeIcon({ size = 24, className, fill = "none" }: Props) {
	const filled = fill !== "none";
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={(1.5 * 24) / size}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}>
			{filled ? (
				<>
					<path
						d="M 9 21 L 9 13 C 9 12.448 9.448 12 10 12 L 14 12 C 14.552 12 15 12.448 15 13 L 15 21 C 16.346 21.067 17.722 21.067 19.095 21 C 20.162 20.948 21 20.068 21 19 L 21 10 C 21 9.411 20.741 8.852 20.291 8.472 L 13.291 2.472 C 12.546 1.842 11.454 1.842 10.709 2.472 L 3.709 8.472 C 3.259 8.852 3 9.411 3 10 L 3 19 C 3 20.09 3.873 20.979 4.962 21 A 105.301 105.301 0 0 0 9 21 Z"
						fill="currentColor"
					/>
				</>
			) : (
				<>
					<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
					<path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
				</>
			)}
		</svg>
	);
}
