import type { Metadata } from "next";

// page.tsx is a client component, so its tab title lives here.
export const metadata: Metadata = { title: "User lists" };

export default function Layout({ children }: { children: React.ReactNode }) {
	return children;
}
