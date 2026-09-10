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
import { WatchedProvider } from "@/components/watched/watched-context";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { I18nProvider } from "@/lib/i18n/i18n-context";
import { getLocale } from "@/lib/i18n/get-locale";

import { fontVariables } from "./fonts";

export const metadata: Metadata = {
	title: "Arthur's corner",
	// Needed to resolve relative openGraph.images URLs into absolute ones for link-preview crawlers. Override via SITE_URL once deployed.
	metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const locale = await getLocale();

	return (
		<html lang={locale} className={fontVariables}>
			<body>
				<I18nProvider locale={locale}>
					<AuthSessionProvider>
						<AvatarProvider>
							<WatchlistProvider>
								<WatchedProvider>
									<Navbar />
									<DevMenu />
									<MobileViewportListener />
									<MediaEditorModal />
									<FeaturedManagerModal />
									<VersionBadge />
									<main>{children}</main>
								</WatchedProvider>
							</WatchlistProvider>
						</AvatarProvider>
					</AuthSessionProvider>
				</I18nProvider>
			</body>
			<SpeedInsights />
			<Analytics />
		</html>
	);
}
