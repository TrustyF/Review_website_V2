import { UserRound } from "lucide-react";

// Shared photo-or-placeholder branching for anywhere a Person's photo shows
// up (cast strip, credits page, ...). Callers own sizing/shape entirely via
// photoClassName/placeholderClassName — this only centralizes the fallback
// logic, not the look.
export function PersonPhoto({
	src,
	alt,
	photoClassName,
	placeholderClassName,
	iconSize = 18,
}: {
	src: string | null;
	alt: string;
	photoClassName: string | undefined;
	placeholderClassName: string | undefined;
	iconSize?: number;
}) {
	return src ? (
		// Proxied third-party photo, not a local/optimizable asset (same as
		// ImagePicker's own thumbnails).
		// eslint-disable-next-line @next/next/no-img-element
		<img src={src} alt={alt} className={photoClassName} />
	) : (
		<span className={placeholderClassName}>
			<UserRound size={iconSize} />
		</span>
	);
}
