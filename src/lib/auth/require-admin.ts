import { auth } from "@/auth";

// The actual server-side enforcement useIsAdmin's client check never had —
// call this at the top of any "use server" mutation gated by an
// admin-only UI (see list-actions.ts), since a server action is directly
// callable regardless of what the client renders.
export async function requireAdmin(): Promise<void> {
	const session = await auth();
	if (session?.user?.role !== "ADMIN") {
		throw new Error("Forbidden");
	}
}
