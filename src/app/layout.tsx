import type { Metadata } from "next";
import "./styles/globals.sass";
import React from "react";
import Navbar from "@/components/navbar/nav-bar";
import { DevMenu } from "@/components/dev-menu/dev-menu";
import { MobileViewportListener } from "@/lib/mobile-viewport-listener";
import MediaEditorModal from "@/components/media/media-management/media-editor/media-editor-modal";
import { FeaturedManagerModal } from "@/components/home/featured-review/featured-manager/featured-manager-modal";
import { AuthSessionProvider } from "@/components/auth/session-provider";
import { VersionBadge } from "@/components/version-badge/version-badge";
import { AvatarProvider } from "@/components/account/avatar-context";
import { WatchlistProvider } from "@/components/watchlist/watchlist-context";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

import { fontVariables } from "./fonts";

export const metadata: Metadata = {
	title: "Arthur's corner",
	// Needed to resolve relative openGraph.images URLs into absolute ones for link-preview crawlers. Override via SITE_URL once deployed.
	metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={fontVariables}>
			<body>
				<AuthSessionProvider>
					<AvatarProvider>
						<WatchlistProvider>
							<Navbar />
							<DevMenu />
							<MobileViewportListener />
							<MediaEditorModal />
							<FeaturedManagerModal />
							<VersionBadge />
							<main>{children}</main>
						</WatchlistProvider>
					</AvatarProvider>
				</AuthSessionProvider>
			</body>
			<SpeedInsights />
			<Analytics />
		</html>
	);
}
