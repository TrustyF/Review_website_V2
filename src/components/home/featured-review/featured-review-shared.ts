import { Sparkles, Heart, type LucideIcon } from "lucide-react";
import { MediaRecord } from "@/components/media/types";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

// One entry per .eyebrow state — icon is optional per variant, so a future label needs no changes to how cards render it.
type EyebrowVariant = {
	label: string;
	icon?: LucideIcon;
};

export function eyebrowFor(
	review: NonNullable<MediaRecord["review"]>,
	dict: Dictionary,
): EyebrowVariant {
	if (review.featured) return { label: dict.home.eyebrowFeatured, icon: Heart };
	return { label: dict.home.eyebrowNew, icon: Sparkles };
}
