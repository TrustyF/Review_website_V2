type Props = {
	size?: number | undefined;
	className?: string | undefined;
	// Matches lucide icons' fill prop for drop-in use at NavLink's call site.
	fill?: string | undefined;
};

// Extracted from lucide-react's ClockFading; since it's all open arcs, filled traces the stroke into a solid shape (via svg-outline-stroke) instead of faking fill on the strokes.
export function WatchlistIcon({ size = 24, className, fill = "none" }: Props) {
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
					stroke="none"
					fill="currentColor"
					fillRule="evenodd"
					d="M 22.741 11.991 C 22.741 17.932 17.925 22.748 11.984 22.748 C 6.043 22.748 1.227 17.932 1.227 11.991 C 1.227 6.05 6.043 1.234 11.984 1.234 C 17.925 1.234 22.741 6.05 22.741 11.991 Z M 11.661 5.33 C 11.571 5.376 11.447 5.484 11.386 5.57 L 11.275 5.725 L 11.275 12.275 L 11.392 12.439 C 11.488 12.573 11.901 12.799 13.666 13.682 C 15.712 14.705 15.835 14.759 16.055 14.738 C 16.492 14.696 16.785 14.346 16.737 13.922 C 16.69 13.506 16.647 13.476 14.621 12.462 L 12.75 11.525 L 12.75 8.683 C 12.75 5.548 12.757 5.618 12.437 5.391 C 12.239 5.25 11.875 5.221 11.661 5.33 Z"
				/>
			) : (
				<>
					<path d="M12 2a10 10 0 0 1 7.38 16.75" />
					<path d="M12 6v6l4 2" />
					<path d="M2.5 8.875a10 10 0 0 0-.5 3" />
					<path d="M2.83 16a10 10 0 0 0 2.43 3.4" />
					<path d="M4.636 5.235a10 10 0 0 1 .891-.857" />
					<path d="M8.644 21.42a10 10 0 0 0 7.631-.38" />
				</>
			)}
		</svg>
	);
}
