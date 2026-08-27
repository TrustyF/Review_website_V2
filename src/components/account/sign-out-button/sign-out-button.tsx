"use client";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Clickable } from "@/components/ui/clickable";
import styles from "./sign-out-button.module.sass";

// Moved off the navbar's own account row (see nav-account-menu.tsx) — it
// isn't reached often enough to earn permanent space on every page, so it
// lives here instead, beside the rest of this account's own controls (see
// account/page.tsx's header, next to the settings gear).
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
