"use client";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Clickable } from "@/components/ui/clickable";
import { useDictionary } from "@/lib/i18n/i18n-context";
import styles from "./sign-out-button.module.sass";

// Moved off the navbar's account row — not reached often enough to earn
// permanent space on every page — to sit beside this account's own controls.
export function SignOutButton() {
	const dict = useDictionary();
	return (
		<Clickable
			className={styles.sign_out}
			onClick={() => signOut({ callbackUrl: "/" })}>
			<LogOut size={18} />
			{dict.account.signOut}
		</Clickable>
	);
}
