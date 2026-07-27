import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./styles/globals.sass";
import React from "react";
import Navbar from "@/components/navbar/nav-bar";
import MediaEditorModal from "@/components/media/media-editor/media-editor-modal";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

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
			className={`${geistSans.variable} ${geistMono.variable}`}
		>
			<body>
				<Navbar />
				<MediaEditorModal />
				<main>{children}</main>
			</body>
		</html>
	);
}
