import { Sparkles, Heart, type LucideIcon } from "lucide-react";
import { MediaRecord } from "@/components/media/types";

// One entry per possible .eyebrow state — an icon is optional per variant
// (only "Featured review" has one today), so adding a future label (e.g.
// something for a highly-rated review) is just another branch here with
// or without its own icon, no change needed to how either card renders it.
type EyebrowVariant = {
	label: string;
	icon?: LucideIcon;
};

export function eyebrowFor(
	review: NonNullable<MediaRecord["review"]>,
): EyebrowVariant {
	if (review.featured) return { label: "Featured review", icon: Heart };
	return { label: "New review", icon: Sparkles };
}
