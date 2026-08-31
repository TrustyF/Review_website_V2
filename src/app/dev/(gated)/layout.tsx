import { notFound } from "next/navigation";
import { ReactNode } from "react";

// Route group (no URL segment): centralizes the dev-only gate so new pages
// here can't ship to prod by omission. Excludes /dev/image-crop, a real
// production admin tool gated by useIsAdmin instead.
export default function GatedDevLayout({ children }: { children: ReactNode }) {
	if (process.env.NODE_ENV !== "development") notFound();
	return children;
}
