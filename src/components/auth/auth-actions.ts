"use server";
import { db } from "@/server/db/client";
import { hashPassword } from "@/lib/password";

export type SignUpInput = {
	name: string;
	email: string;
	password: string;
	preferredLanguage: string;
	newsletterOptIn: boolean;
};

// Only creates the row — deliberately doesn't also sign the browser in.
// Auth.js's signIn() sets its session cookie via the server action's
// response, but useSession() (see Navbar) keeps its own client-side copy of
// the session that a cookie change alone doesn't invalidate — only a client-
// side signIn() call updates it. SignupPage calls next-auth/react's signIn
// itself right after this resolves, the same way LoginPage already does.
export async function signUp(input: SignUpInput): Promise<void> {
	const email = input.email.trim().toLowerCase();
	if (!email) throw new Error("Email is required");
	if (input.password.length < 8) {
		throw new Error("Password must be at least 8 characters");
	}

	const existing = await db.user.findUnique({ where: { email } });
	if (existing) throw new Error("An account with this email already exists");

	await db.user.create({
		data: {
			email,
			name: input.name.trim() || null,
			passwordHash: await hashPassword(input.password),
			preferredLanguage: input.preferredLanguage,
			newsletterOptIn: input.newsletterOptIn,
		},
	});
}
