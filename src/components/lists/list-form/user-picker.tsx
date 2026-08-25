"use client";
import { useState } from "react";
import { Globe, UserRound } from "lucide-react";
import { Clickable } from "@/components/ui/clickable";
import { RecommendationTargetOption } from "@/components/lists/list-actions";
import { displayName } from "@/lib/display-name";
import styles from "./user-picker.module.sass";

type Props = {
	options: RecommendationTargetOption[];
	value: string | null;
	onChange: (id: string | null) => void;
};

// "Recommend to" picker for ListForm — a row of avatar tiles (one per
// registered user, plus a leading "Public" tile for null) rather than a
// plain <select>, so an admin picking a recipient recognizes them by face
// rather than having to read every name/email in a dropdown.
export function UserPicker({ options, value, onChange }: Props) {
	// Per-user failed-load tracking (a stale/broken User.image — same class
	// of issue AvatarPicker's own imageFailed guards against) — a Set rather
	// than one boolean since any number of the tiles here could fail
	// independently.
	const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

	function markFailed(id: string) {
		setFailedIds((prev) => new Set(prev).add(id));
	}

	return (
		<div className={styles.grid}>
			<Clickable
				className={`${styles.option} ${value === null ? styles.option_selected : ""}`}
				aria-label="Public — visible to everyone"
				aria-pressed={value === null}
				onClick={() => onChange(null)}>
				<div className={styles.avatar_placeholder}>
					<Globe size={20} />
				</div>
				<span className={styles.name}>Public</span>
			</Clickable>
			{options.map((user) => {
				const hasImage = user.image && !failedIds.has(user.id);
				const label = displayName(user);
				return (
					<Clickable
						key={user.id}
						className={`${styles.option} ${value === user.id ? styles.option_selected : ""}`}
						aria-label={label}
						aria-pressed={value === user.id}
						onClick={() => onChange(user.id)}>
						{hasImage ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={user.image!}
								alt=""
								className={styles.avatar}
								onError={() => markFailed(user.id)}
							/>
						) : (
							<div className={styles.avatar_placeholder}>
								<UserRound size={20} />
							</div>
						)}
						<span className={styles.name}>{label}</span>
					</Clickable>
				);
			})}
		</div>
	);
}
