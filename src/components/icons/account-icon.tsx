type Props = {
	size?: number | undefined;
	className?: string | undefined;
	// Matches lucide icons' fill prop for drop-in use at NavLink's call site.
	fill?: string | undefined;
};

// Extracted from lucide-react's UserRound so the filled variant can be hand-edited; lucide has no filled set.
export function AccountIcon({ size = 24, className, fill = "none" }: Props) {
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
						d="M 17 8 C 17 10.146 15.648 11.976 13.749 12.685 C 15.392 13.037 16.888 13.866 18.011 14.989 C 18.768 15.746 19.408 16.689 19.832 17.691 C 20.208 18.579 20.412 20.34 20.453 20.728 C 20.496 21.078 20.518 21.434 20.518 21.795 L 3.462 21.795 C 3.462 21.514 3.475 21.236 3.501 20.963 C 3.533 18.665 4.488 16.493 5.991 14.989 C 7.113 13.867 8.609 13.038 10.252 12.686 C 8.353 11.977 7 10.146 7 8 C 7 5.239 9.239 3 12 3 C 14.761 3 17 5.239 17 8 Z"
						fill="currentColor"
					/>
				</>
			) : (
				<>
					<circle cx="12" cy="8" r="5" />
					<path d="M20 21a8 8 0 0 0-16 0" />
				</>
			)}
		</svg>
	);
}
