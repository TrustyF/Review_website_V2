"use client";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Clickable } from "@/components/ui/clickable";
import styles from "./sign-out-button.module.sass";

// Moved off the navbar's account row — not reached often enough to earn
// permanent space on every page — to sit beside this account's own controls.
export function SignOutButton() {
	return (
		<Clickable
			className={styles.sign_out}
			onClick={() => signOut({ callbackUrl: "/" })}>
			<LogOut size={18} />
			Sign out
		</Clickable>
	);
}
