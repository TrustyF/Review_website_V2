type Props = {
	size?: number | undefined;
	className?: string | undefined;
	// Matches lucide icons' fill prop for drop-in use at NavLink/NavDropdown call sites.
	fill?: string | undefined;
};

// Extracted from lucide-react's Clapperboard; diagonal stripes rely on fillRule="evenodd" to cut through the body rather than fill solid.
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
						fill="currentColor"
						fillRule="evenodd"
						clipRule="nonzero"
						d="M6.332 6.271c-.172-.216-.136-.531.08-.703.216-.172.531-.136.703.08L9.061 8.096c.172.216.136.531-.08.703-.216.172-.531.136-.703-.08L6.332 6.271Zm6.081-1.829c-.168-.22-.125-.533.094-.701.22-.168.533-.125.701.094L15.181 6.42c.168.22.125.533-.094.701-.22.168-.533.125-.701-.094L12.413 4.442ZM2.5 11.089V19c.022.655.307 1.343.732 1.768.425.425 1.114.71 1.768.732H19c.655-.022 1.343-.307 1.768-.732s.71-1.114.732-1.768V10.5H6.51L20.828 6.338l-.949-3.085c-.202-.593-.666-1.154-1.195-1.433-.526-.278-1.265-.36-1.915-.203L3.259 5.62c-.593.201-1.159.667-1.438 1.196-.278.526-.36 1.265-.203 1.915Z"
					/>
				</>
			) : (
				<>
					<path d="M6.332 6.271c-.172-.216-.136-.531.08-.703.216-.172.531-.136.703.08L9.061 8.096c.172.216.136.531-.08.703-.216.172-.531.136-.703-.08L6.332 6.271Zm6.081-1.829c-.168-.22-.125-.533.094-.701.22-.168.533-.125.701.094L15.181 6.42c.168.22.125.533-.094.701-.22.168-.533.125-.701-.094L12.413 4.442ZM2.5 11.089V19c.022.655.307 1.343.732 1.768.425.425 1.114.71 1.768.732H19c.655-.022 1.343-.307 1.768-.732s.71-1.114.732-1.768V10.5H6.51L20.828 6.338l-.949-3.085c-.202-.593-.666-1.154-1.195-1.433-.526-.278-1.265-.36-1.915-.203L3.259 5.62c-.593.201-1.159.667-1.438 1.196-.278.526-.36 1.265-.203 1.915Z" />
				</>
			)}
		</svg>
	);
}
