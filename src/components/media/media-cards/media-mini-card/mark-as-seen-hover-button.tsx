"use client";
import { useState } from "react";
import { Eye } from "lucide-react";
import { useSession } from "next-auth/react";
import { Clickable } from "@/components/ui/clickable";
import styles from "./media-hover-badge.module.sass";

type Props = {
	mediaId: number;
	className?: string | undefined;
};

// TODO: stub only — toggles local state, no "already seen" field/mutation exists yet.
export function MarkAsSeenHoverButton({ mediaId, className }: Props) {
	const { data: session } = useSession();
	const [seen, setSeen] = useState(false);

	if (!session?.user?.id) return null;

	const label = seen ? "Already seen" : "Mark as seen";

	return (
		<Clickable
			className={className ? `${styles.badge} ${className}` : styles.badge}
			aria-pressed={seen}
			title={label}
			aria-label={label}
			onClick={() => setSeen((prev) => !prev)}>
			<Eye size={13} />
		</Clickable>
	);
}
