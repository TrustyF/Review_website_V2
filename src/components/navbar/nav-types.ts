import type { LucideIcon } from "lucide-react";

// Widened past LucideIcon so local icon components (HomeIcon, etc.), which
// only accept size/className/fill, satisfy it too.
export type NavIcon = React.ComponentType<{
	size?: number | undefined;
	className?: string | undefined;
	fill?: string | undefined;
}>;

export type { LucideIcon };
