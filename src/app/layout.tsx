import type { Metadata } from "next";
import "./styles/globals.sass";
import React from "react";
import Navbar from "@/components/navbar/nav-bar";
import { DevMenu } from "@/components/dev-menu/dev-menu";
import MediaEditorModal from "@/components/media/media-management/media-editor/media-editor-modal";
import { fontVariables } from "./fonts";

export const metadata: Metadata = {
	title: "Review app",
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
				<Navbar />
				<DevMenu />
				<MediaEditorModal />
				<main>{children}</main>
			</body>
		</html>
	);
}
