import type { Metadata } from "next";
import { MediaTypeListPage } from "@/components/media/media-pages/media-type-list-page/media-type-list-page";
import { MediaType } from "@prisma/client";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export const metadata: Metadata = {
	title: "Video Game Reviews",
	description: "Arthur Sirjacobs' ratings and reviews of video games.",
	alternates: { canonical: "/games" },
};

export default async function GamesPage() {
	const dict = await getDictionary();
	return (
		<MediaTypeListPage
			title={dict.nav.games}
			type={MediaType.GAME}
			include={{ game: true }}
		/>
	);
}
