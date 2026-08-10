"use client";
import { useSession } from "next-auth/react";

// Replaces the old is-admin-store.ts dev stand-in — same one-line boolean
// shape every admin-gated component already expects, now backed by the
// real session instead of an always-true client flag.
export function useIsAdmin(): boolean {
	const { data: session } = useSession();
	return session?.user?.role === "ADMIN";
}
