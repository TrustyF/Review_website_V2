import { notFound } from "next/navigation";
import { ReactNode } from "react";

// Route group, not a URL segment — /dev/gauges and /dev/banner-compression
// keep their paths. Centralizes the dev-only gate so a new page dropped in
// here can't ship to production by forgetting its own check; deliberately
// excludes /dev/image-crop (a real production admin tool, gated by
// useIsAdmin instead — see dev-menu.tsx's own comment on that split).
export default function GatedDevLayout({ children }: { children: ReactNode }) {
	if (process.env.NODE_ENV !== "development") notFound();
	return children;
}
