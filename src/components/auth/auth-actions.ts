"use server";
import { db } from "@/server/db/client";
import { hashPassword } from "@/lib/password";

export type SignUpInput = {
	name: string;
	email: string;
	password: string;
};

// Only creates the row — doesn't sign the browser in. useSession()'s client-side
// session copy only updates via a client-side signIn() call, not a cookie change
// alone, so SignupPage calls next-auth/react's signIn itself right after this resolves.
export async function signUp(input: SignUpInput): Promise<void> {
	const email = input.email.trim().toLowerCase();
	if (!email) throw new Error("Email is required");
	if (input.password.length < 8) {
		throw new Error("Password must be at least 8 characters");
	}

	const existing = await db.user.findUnique({ where: { email } });
	if (existing) throw new Error("An account with this email already exists");

	// preferredLanguage/newsletterOptIn/username/image are picked in the
	// /onboarding wizard right after this, not collected here — this only
	// needs enough to create the row and let the caller sign in.
	await db.user.create({
		data: {
			email,
			name: input.name.trim() || null,
			passwordHash: await hashPassword(input.password),
		},
	});
}
