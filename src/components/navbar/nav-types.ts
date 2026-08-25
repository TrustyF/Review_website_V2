import type { LucideIcon } from "lucide-react";

// Widened past lucide's own LucideIcon type so local icon components (e.g.
// HomeIcon, MovieIcon, AccountIcon) — which only accept the size/className/
// fill subset the navbar actually passes — satisfy it too. Shared between
// nav-link.tsx and nav-dropdown.tsx rather than each declaring its own copy.
export type NavIcon = React.ComponentType<{
	size?: number | undefined;
	className?: string | undefined;
	fill?: string | undefined;
}>;

export type { LucideIcon };
