import { ComponentProps, forwardRef } from "react";
import NextLink from "next/link";

type Props = ComponentProps<typeof NextLink>;

// Drop-in replacement for next/link — same API, but defaults `prefetch` to
// false instead of Next's own default ("auto"/null). Next's default fires a
// real server-side invocation for any dynamic route with a loading.tsx
// boundary the moment the link scrolls into the viewport, not just on click
// — a grid of dozens of cards (see media/primitives/poster.tsx's history)
// silently cost dozens of invocations before anyone clicked anything.
// Pass `prefetch` explicitly (true, or one of Next's own values) for a link
// where eager prefetch is actually wanted — e.g. a genuinely static route,
// where prefetching is served from the CDN rather than invoking a function.
export const Link = forwardRef<HTMLAnchorElement, Props>(function Link(
	{ prefetch = false, ...props },
	ref,
) {
	return <NextLink ref={ref} prefetch={prefetch} {...props} />;
});
