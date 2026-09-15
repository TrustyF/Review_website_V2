"use client";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { Clickable } from "@/components/ui/clickable";
import styles from "./back-button.module.sass";

type Props = {
	className?: string | undefined;
};

// Browser-history back, not a hardcoded link — a detail page can be reached from many places (nav, home, search, a list, ...), so the previous page is whatever actually got you here.
export function BackButton({ className }: Props) {
	const router = useRouter();

	return (
		<Clickable
			className={`${styles.back_button} ${className ?? ""}`}
			aria-label="Go back"
			onClick={() => router.back()}>
			<Undo2 size={20} />
		</Clickable>
	);
}
