"use client";
import { useState, useTransition } from "react";
import { HomeMediaRow } from "@/components/home/home-media-row";
import { SpinButton } from "@/components/home/spin-button/spin-button";
import { PersonPhoto } from "@/components/media/primitives/person-photo";
import { Link } from "@/components/ui/link";
import { useDictionary } from "@/lib/i18n/i18n-context";
import type { PersonSpotlightData } from "./person-spotlight-query";
import { fetchRandomPersonSpotlight } from "./person-spotlight-actions";
import styles from "./person-spotlight-section.module.sass";

export function PersonSpotlightRow({
	initial,
}: {
	initial: PersonSpotlightData;
}) {
	const dict = useDictionary();
	const [data, setData] = useState(initial);
	const [isPending, startTransition] = useTransition();

	function spin() {
		startTransition(async () => {
			const next = await fetchRandomPersonSpotlight(data.role, data.person.id);
			if (next) setData(next);
		});
	}

	const { person } = data;
	return (
		<HomeMediaRow
			title={
				data.role === "DIRECTOR"
					? dict.home.directorSpotlight
					: dict.home.actorSpotlight
			}
			items={data.items}
			action={<SpinButton onSpin={spin} pending={isPending} />}
			pending={isPending}
			intro={
				<Link href={`/credits/person/${person.id}`} className={styles.intro}>
					<PersonPhoto
						src={person.photoSrc}
						alt={person.name}
						photoClassName={styles.photo}
						placeholderClassName={styles.photo_placeholder}
						iconSize={22}
					/>
					<span className={styles.text}>
						<span className={styles.name}>{person.name}</span>
						<span className={styles.summary}>
							{dict.home.personSummary(
								data.filmCount,
								data.avgRating.toFixed(1),
							)}
						</span>
					</span>
				</Link>
			}
		/>
	);
}
