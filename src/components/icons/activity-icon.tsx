type Props = {
	size?: number | undefined;
	className?: string | undefined;
	// Matches the fill prop lucide icons take, so this drops into NavLink's
	// existing `fill={isActive ? "currentColor" : "none"}` call site unchanged.
	fill?: string | undefined;
};

// Extracted from lucide-react's Zap icon so the filled variant below can be
// hand-edited independently of the outline — lucide only ships outline
// artwork, no separate filled set. Starts as the same bolt path filled solid
// rather than stroked, since Zap (unlike e.g. WatchlistIcon's arcs) is
// already a single closed shape.
export function ActivityIcon({ size = 24, className, fill = "none" }: Props) {
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
				<path
					d="M 20.435 9.23 C 20.328 9.098 20.143 9.031 19.958 9.063 L 14.193 10.003 L 15.363 0.436 C 15.387 0.253 15.259 0.083 15.055 0.023 C 14.851 -0.038 14.628 0.026 14.509 0.178 L 3.564 14.332 C 3.461 14.464 3.461 14.638 3.568 14.77 C 3.672 14.901 3.857 14.967 4.043 14.938 L 9.808 13.997 L 8.638 23.563 C 8.615 23.746 8.742 23.916 8.945 23.978 C 8.996 23.992 9.049 24 9.102 24 C 9.259 24 9.405 23.932 9.493 23.821 L 20.436 9.668 C 20.54 9.534 20.539 9.362 20.435 9.23 Z"
					fill="currentColor"
					// strokeLinejoin="round"
				/>
			) : (
				<path d="M 20.435 9.23 C 20.328 9.098 20.143 9.031 19.958 9.063 L 14.193 10.003 L 15.363 0.436 C 15.387 0.253 15.259 0.083 15.055 0.023 C 14.851 -0.038 14.628 0.026 14.509 0.178 L 3.564 14.332 C 3.461 14.464 3.461 14.638 3.568 14.77 C 3.672 14.901 3.857 14.967 4.043 14.938 L 9.808 13.997 L 8.638 23.563 C 8.615 23.746 8.742 23.916 8.945 23.978 C 8.996 23.992 9.049 24 9.102 24 C 9.259 24 9.405 23.932 9.493 23.821 L 20.436 9.668 C 20.54 9.534 20.539 9.362 20.435 9.23 Z" />
			)}
		</svg>
	);
}
