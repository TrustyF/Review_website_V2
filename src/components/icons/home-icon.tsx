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
						d="M3 19a2 2 0 002 2H19a2 2 0 002-2V10a2 2 0 00-.709-1.528l-7-6a2 2 0 00-2.582 0l-7 6A2 2 0 003 10Zm6 2V13a1 1 0 011-1h4a1 1 0 011 1v8"
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
