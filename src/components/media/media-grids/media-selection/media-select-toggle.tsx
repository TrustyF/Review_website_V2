"use client";
import { Pencil } from "lucide-react";
import { useSession } from "next-auth/react";
import { Clickable } from "@/components/ui/clickable";
import { useDictionary } from "@/lib/i18n/i18n-context";
import { useMediaSelection } from "./media-selection-context";
import styles from "./media-selection.module.sass";

// Grid-controls trigger that enters/leaves select mode. Signed-out visitors have nothing to bulk-apply.
export function MediaSelectToggle() {
	const dict = useDictionary();
	const { data: session } = useSession();
	const selection = useMediaSelection();
	if (!session?.user?.id || !selection) return null;

	const label = selection.isActive
		? dict.media.selection.cancel
		: dict.media.selection.select;

	return (
		<Clickable
			className={styles.trigger}
			aria-pressed={selection.isActive}
			title={label}
			aria-label={label}
			onClick={() => selection.setActive(!selection.isActive)}>
			<Pencil size={16} />
		</Clickable>
	);
}
