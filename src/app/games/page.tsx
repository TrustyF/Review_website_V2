import type { Metadata } from "next";
import { MediaTypeListPage } from "@/components/media/media-pages/media-type-list-page/media-type-list-page";
import { MediaType } from "@prisma/client";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
	const dict = await getDictionary();
	return {
		title: dict.nav.games,
		description: "Arthur Sirjacobs' ratings and reviews of video games.",
		alternates: { canonical: "/games" },
	};
}

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
