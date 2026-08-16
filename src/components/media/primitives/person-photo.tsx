import { UserRound } from "lucide-react";
import styles from "./person-photo.module.sass";

// Shared photo-or-placeholder branching for anywhere a Person's photo shows
// up (cast strip, credits page, ...). Owns its own default look (see
// person-photo.module.sass) — the real photo and its placeholder share one
// definition there, so they can't drift apart the way two callers each
// hand-typing the same values could. photoClassName/placeholderClassName
// are appended on top of that default rather than replacing it, so a caller
// only needs one when it wants to *add* something the default doesn't
// already cover (e.g. credit-media-list-page.module.sass's own .photo
// adding flex-shrink/object-position on top of this) — a caller can't use
// them to reliably *override* a property the default already sets, since
// CSS Modules give no guarantee which of two same-specificity classes from
// different files wins.
export function PersonPhoto({
	src,
	alt,
	photoClassName,
	placeholderClassName,
	iconSize = 18,
}: {
	src: string | null;
	alt: string;
	// CSS module class lookups are typed as possibly-undefined (an unknown
	// key would silently produce `undefined`) — matches that rather than
	// requiring callers to non-null-assert every styles.xxx they pass, and
	// both are genuinely optional besides (see this component's own comment
	// on why a caller doesn't need one just to get the default look).
	photoClassName?: string | undefined;
	placeholderClassName?: string | undefined;
	iconSize?: number;
}) {
	return src ? (
		// Proxied third-party photo, not a local/optimizable asset (same as
		// ImagePicker's own thumbnails).
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={src}
			alt={alt}
			className={`${styles.photo} ${photoClassName ?? ""}`}
		/>
	) : (
		<span className={`${styles.placeholder} ${placeholderClassName ?? ""}`}>
			<UserRound size={iconSize} />
		</span>
	);
}
