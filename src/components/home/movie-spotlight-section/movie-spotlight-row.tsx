"use client";
import { Cone } from "lucide-react";
import { useState, useTransition } from "react";
import type { MediaCardRecord } from "@/components/media/types";
import { HomeMediaRow } from "@/components/home/home-media-row";
import { SpinButton } from "@/components/home/spin-button/spin-button";
import { useDictionary } from "@/lib/i18n/i18n-context";
import { fetchMovieSpotlight } from "./movie-spotlight-actions";

export function MovieSpotlightRow({ initial }: { initial: MediaCardRecord[] }) {
	const dict = useDictionary();
	const [items, setItems] = useState(initial);
	const [isPending, startTransition] = useTransition();

	function spin() {
		startTransition(async () => {
			const next = await fetchMovieSpotlight(items.map((m) => m.id));
			if (next.length > 0) setItems(next);
		});
	}

	return (
		<HomeMediaRow
			icon={Cone}
			title={dict.home.movieSpotlight}
			subtitle={dict.home.subtitles.movieSpotlight}
			items={items}
			action={<SpinButton onSpin={spin} pending={isPending} />}
			pending={isPending}
		/>
	);
}
