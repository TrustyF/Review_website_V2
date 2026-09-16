"use client";
import { useState } from "react";
import { UserRound } from "lucide-react";
import { Link } from "@/components/ui/link";
import { Clickable } from "@/components/ui/clickable";
import { useDictionary } from "@/lib/i18n/i18n-context";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import type {
	PersonRanking,
	PersonRole,
	PersonStat,
} from "@/components/stats/stats-types";
import styles from "./top-people.module.sass";

type Props = {
	topPeople: Record<PersonRole, PersonRanking>;
};

type Mode = "titles" | "rating";

const ROLES: PersonRole[] = ["ACTOR", "DIRECTOR"];

const ROLE_LABEL: Record<PersonRole, (dict: Dictionary) => string> = {
	ACTOR: (dict) => dict.stats.topPeople.roleActors,
	DIRECTOR: (dict) => dict.stats.topPeople.roleDirectors,
};

// Plain <img> with an onError fallback — simpler than person-photo.tsx's
// preload-before-show dance, which isn't worth it for a small grid tile.
function PersonPhotoTile({ src }: { src: string | null }) {
	const [errored, setErrored] = useState(false);
	if (!src || errored) {
		return (
			<span className={styles.photo_placeholder}>
				<UserRound size={20} />
			</span>
		);
	}
	return (
		// Proxied third-party photo, not a local/optimizable asset — same as person-photo.tsx's own.
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={src}
			alt=""
			className={styles.photo}
			onError={() => setErrored(true)}
		/>
	);
}

function PersonCard({
	person,
	mode,
	dict,
}: {
	person: PersonStat;
	mode: Mode;
	dict: Dictionary;
}) {
	const caption =
		mode === "titles"
			? dict.stats.titleCount(person.count)
			: person.avgRating != null
				? `${person.avgRating.toFixed(1)}/10`
				: "—";

	return (
		<Link href={`/credits/person/${person.id}`} className={styles.card}>
			<PersonPhotoTile src={person.photoSrc} />
			<span className={styles.card_name}>{person.name}</span>
			<span className={styles.card_caption}>{caption}</span>
		</Link>
	);
}

export function TopPeople({ topPeople }: Props) {
	const dict = useDictionary();
	const [mode, setMode] = useState<Mode>("titles");

	return (
		<div className={styles.wrapper}>
			<div className={styles.toggle}>
				<Clickable
					className={styles.toggle_option}
					aria-pressed={mode === "titles"}
					data-active={mode === "titles"}
					onClick={() => setMode("titles")}>
					{dict.stats.modeToggle.titles}
				</Clickable>
				<Clickable
					className={styles.toggle_option}
					aria-pressed={mode === "rating"}
					data-active={mode === "rating"}
					onClick={() => setMode("rating")}>
					{dict.stats.modeToggle.rating}
				</Clickable>
			</div>

			<div className={styles.groups}>
				{ROLES.map((role) => {
					const ranking = topPeople[role];
					const people =
						mode === "titles" ? ranking.byTitles : ranking.byRating;
					return (
						<div className={styles.group} key={role}>
							<h3 className={styles.group_title}>{ROLE_LABEL[role](dict)}</h3>
							{people.length === 0 ? (
								<p className={styles.empty}>{dict.stats.topPeople.empty}</p>
							) : (
								<div className={styles.grid}>
									{people.map((person) => (
										<PersonCard
											key={person.id}
											person={person}
											mode={mode}
											dict={dict}
										/>
									))}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
