import { Sparkles, Heart, type LucideIcon } from "lucide-react";
import { MediaRecord } from "@/components/media/types";

// One entry per .eyebrow state — icon is optional per variant, so a future label needs no changes to how cards render it.
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
