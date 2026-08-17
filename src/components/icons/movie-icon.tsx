type Props = {
	size?: number | undefined;
	className?: string | undefined;
	// Matches the fill prop lucide icons take, so this drops into NavLink's/
	// NavDropdown's existing `fill={isActive ? "currentColor" : "none"}` call
	// sites unchanged.
	fill?: string | undefined;
};

// Extracted from lucide-react's Clapperboard icon so the filled variant below
// can be hand-edited independently of the outline — lucide only ships
// outline artwork, no separate filled set. The filled branch is just the
// arm/box shapes filled solid, with the diagonal stripe accents dropped —
// hand-add them back in (e.g. via an SVG mask) if the solid silhouette isn't
// enough on its own.
export function MovieIcon({ size = 24, className, fill = "none" }: Props) {
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
						d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z"
						stroke="none"
						fill="currentColor"
					/>
					<path
						d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
						stroke="none"
						fill="currentColor"
					/>
				</>
			) : (
				<>
					<path d="m12.296 3.464 3.02 3.956" />
					<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z" />
					<path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
					<path d="m6.18 5.276 3.1 3.899" />
				</>
			)}
		</svg>
	);
}
