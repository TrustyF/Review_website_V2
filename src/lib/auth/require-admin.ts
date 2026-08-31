import { auth } from "@/auth";

// Call at the top of admin-gated "use server" mutations — a server action
// is directly callable regardless of what the client renders.
export async function requireAdmin(): Promise<void> {
	const session = await auth();
	if (session?.user?.role !== "ADMIN") {
		throw new Error("Forbidden");
	}
}
