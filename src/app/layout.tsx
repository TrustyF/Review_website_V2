import type { Metadata } from "next";
import "./styles/globals.sass";
import React from "react";
import Navbar from "@/components/navbar/nav-bar";
import { DevMenu } from "@/components/dev-menu/dev-menu";
import MediaEditorModal from "@/components/media/media-management/media-editor/media-editor-modal";
import { AuthSessionProvider } from "@/components/auth/session-provider";
import { fontVariables } from "./fonts";

export const metadata: Metadata = {
	title: "Review app",
	// Needed for Next to resolve a relative openGraph.images URL (see
	// media/[id]/metadata.ts) into the absolute one link-preview crawlers
	// (Discord, Slack, ...) require — they fetch server-side with no page
	// context to resolve a relative URL against. Override via SITE_URL once
	// this is actually deployed somewhere other than localhost.
	metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={fontVariables}
		>
			<body>
				<AuthSessionProvider>
					<Navbar />
					<DevMenu />
					<MediaEditorModal />
					<main>{children}</main>
				</AuthSessionProvider>
			</body>
		</html>
	);
}
