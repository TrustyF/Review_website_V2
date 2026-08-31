"use client";
import { useSession } from "next-auth/react";

// Replaces the old is-admin-store.ts dev stand-in with the real session check.
export function useIsAdmin(): boolean {
	const { data: session } = useSession();
	return session?.user?.role === "ADMIN";
}
