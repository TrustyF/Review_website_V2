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
	// Omits the "Public" tile — for pickers that only ever navigate to a specific user.
	hidePublicOption?: boolean;
};

// "Recommend to" picker: avatar tiles instead of a <select>, so an admin recognizes a recipient by face.
export function UserPicker({ options, value, onChange, hidePublicOption }: Props) {
	// Set, not one boolean, since multiple tiles' images can fail to load independently.
	const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

	function markFailed(id: string) {
		setFailedIds((prev) => new Set(prev).add(id));
	}

	return (
		<div className={styles.grid}>
			{!hidePublicOption && (
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
			)}
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
