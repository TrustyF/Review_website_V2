import { Sparkles, Heart, type LucideIcon } from "lucide-react";
import { MediaRecord } from "@/components/media/types";

// Teaser only — the full body is one click away on the media page itself.
// A few paragraphs rather than just the first, capped visually by
// .excerpt's own line-clamp for anything longer. Passed to ReviewBody as
// maxBlocks (a post-parse block count, not a raw \n\n split) so a spoiler
// spanning the cutoff point is either included whole or excluded whole,
// never cut mid-way — see that prop's own comment for what broke before.
// Shared by both FeaturedReviewCard and its mobile counterpart so their
// excerpts stay cut at the same point.
export const EXCERPT_MAX_BLOCKS = 3;

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
