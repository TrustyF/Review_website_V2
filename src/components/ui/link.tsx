import { ComponentProps, forwardRef } from "react";
import NextLink from "next/link";

type Props = ComponentProps<typeof NextLink>;

// Prefetch defaults false (Next's auto fires on scroll).
// Pass explicitly for static routes where eager prefetch is wanted.
export const Link = forwardRef<HTMLAnchorElement, Props>(function Link(
	{ prefetch = false, ...props },
	ref,
) {
	return <NextLink ref={ref} prefetch={prefetch} {...props} />;
});
