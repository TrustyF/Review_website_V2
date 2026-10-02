import type { Metadata } from "next";

// page.tsx is a client component, so its tab title lives here.
export const metadata: Metadata = { title: "Add media" };

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
